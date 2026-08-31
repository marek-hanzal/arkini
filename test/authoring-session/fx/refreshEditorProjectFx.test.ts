import { Cause, Effect, Exit, Option, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import type { EditorProjectRepositoryService } from "~/project-authoring/service/EditorProjectRepository";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/project-authoring/service/EditorProjectWriteAdmission";
import type { EditorBoardGameResource } from "~/board-scenario/session/EditorBoardGameResource";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/session/EditorBoardGameResourceOwnerAtom";
import { refreshEditorProjectFx } from "~/authoring-session/fx/refreshEditorProjectFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 9,
	revision: 9,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const runRefresh = async (mode: "failure" | "renamed" | "same" = "same") => {
	const events: string[] = [];
	const registry = AtomRegistry.make();
	const state = Effect.runSync(
		SubscriptionRef.make<EditorBoardGameResource.State>({
			type: "idle",
		}),
	);
	const owner = {
		state,
		syncFx: (nextProject) =>
			Effect.sync(() => events.push(`board-sync-${nextProject.revision}`)),
		publishFx: (nextProject) =>
			Effect.sync(() => events.push(`board-publish-${nextProject.revision}`)),
		replaceFx: () => Effect.void,
		releaseCurrentFx: Effect.sync(() => events.push("board-release")),
		shutdownFx: Effect.void,
	} satisfies EditorBoardGameResource;
	Effect.runSync(
		Effect.all([
			Atom.set(EditorBoardGameResourceOwnerAtom, owner),
			Atom.set(EditorProjectAtom(project.projectId), {
				project,
			}),
		]).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
	);
	vi.stubGlobal("window", {
		arkini: {
			editor: {
				refreshProject: async (): Promise<
					EditorProjectTransport.Result<EditorProjectTransport.Project>
				> => {
					events.push("refresh");
					if (mode === "failure")
						return {
							type: "failure",
							error: {
								operation: "refresh-project",
								message: "Refresh failed.",
							},
						};
					return {
						type: "success",
						value: {
							...project,
							projectId: mode === "renamed" ? "project-two" : project.projectId,
							updatedAtMs: 7,
							revision: 7,
						},
					};
				},
			},
		},
	});
	const repository: EditorProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.sync(() => events.push("idle")),
		createProjectFx: () => Effect.die("Unexpected project create."),
		listProjectsFx: Effect.die("Unexpected project list."),
		readProjectFx: () => Effect.die("Unexpected project read."),
		replaceConfigFx: () => Effect.die("Unexpected config write."),
		replaceResourceFx: () => Effect.die("Unexpected resource write."),
		deleteItemFx: () => Effect.die("Unexpected item delete."),
		upsertItemFx: () => Effect.die("Unexpected item write."),
		upsertResourcesFx: () => Effect.die("Unexpected resources write."),
	};
	const unsaved = {
		decide: async () => undefined,
		discardAll: () => events.push("discard"),
		getSnapshot: () => ({
			canSave: false,
			error: undefined,
			hasDirtySession: true,
			promptOpen: false,
			saving: false,
		}),
		refresh: () => undefined,
		register: () => () => undefined,
		requestLeave: async () => {
			events.push("prompt");
			return false;
		},
		subscribe: () => () => undefined,
	};
	try {
		const exit = await Effect.runPromiseExit(
			refreshEditorProjectFx({
				projectId: project.projectId,
			}).pipe(
				Effect.provideService(EditorProjectRepository, repository),
				Effect.provideService(EditorUnsavedChanges, unsaved),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		return {
			events,
			exit,
			published: registry.get(EditorProjectAtom(project.projectId)),
			replacementEpoch: registry.get(EditorProjectReplacementEpochAtom(project.projectId)),
		};
	} finally {
		vi.unstubAllGlobals();
		registry.dispose();
	}
};

describe("refreshEditorProjectFx", () => {
	it("hard-discards drafts only after the filesystem refresh succeeds", async () => {
		const result = await runRefresh();
		expect(Exit.isSuccess(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"board-release",
			"refresh",
			"discard",
			"board-publish-7",
			"board-sync-7",
		]);
		expect(result.published?.revision).toBe(7);
		expect(result.replacementEpoch).toBe(1);
	});

	it("returns a renamed project for route replacement without publishing under the old ID", async () => {
		const result = await runRefresh("renamed");
		expect(Exit.isSuccess(result.exit)).toBe(true);
		if (Exit.isSuccess(result.exit)) expect(result.exit.value.projectId).toBe("project-two");
		expect(result.events).toEqual([
			"idle",
			"board-release",
			"refresh",
			"discard",
		]);
		expect(result.published?.revision).toBe(9);
		expect(result.replacementEpoch).toBe(0);
	});

	it("restores the mounted Board when filesystem refresh fails", async () => {
		const result = await runRefresh("failure");
		expect(Exit.isFailure(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"board-release",
			"refresh",
			"board-sync-9",
		]);
		expect(result.published?.revision).toBe(9);
		expect(result.replacementEpoch).toBe(0);
	});

	it("reports replacement ownership collisions without touching mounted state", async () => {
		const release = blockEditorProjectWrites();
		try {
			const result = await runRefresh();
			expect(Exit.isFailure(result.exit)).toBe(true);
			if (Exit.isFailure(result.exit))
				expect(Option.isSome(Cause.findErrorOption(result.exit.cause))).toBe(true);
			expect(result.events).toEqual([]);
			expect(result.published?.revision).toBe(9);
			expect(result.replacementEpoch).toBe(0);
		} finally {
			release();
		}
	});
});
