import { Cause, Effect, Exit, Option, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectAtom } from "~/ui/editor/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-shell/session/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/renderer/editor/unsaved/EditorUnsavedChanges";
import type { EditorBoardGameResource } from "~/board-scenario/session/EditorBoardGameResource";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/session/EditorBoardGameResourceOwnerAtom";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/project-version/workspace/EditorProjectVersionCheckoutConfirmationRequired";
import { checkoutEditorProjectVersionFx } from "~/project-version/workspace/checkoutEditorProjectVersionFx";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 1,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const runCheckout = async ({
	confirm = true,
	dirty = false,
	fail = false,
}: {
	readonly confirm?: boolean;
	readonly dirty?: boolean;
	readonly fail?: boolean;
} = {}) => {
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
		publishFx: () => Effect.void,
		replaceFx: () => Effect.void,
		releaseCurrentFx: Effect.sync(() => events.push("board-release")),
		shutdownFx: Effect.void,
	} satisfies EditorBoardGameResource;
	Effect.runSync(
		Atom.set(EditorBoardGameResourceOwnerAtom, owner).pipe(
			Effect.provideService(AtomRegistry.AtomRegistry, registry),
		),
	);
	const checkoutVersionFx: EditorProjectRepositoryService["checkoutVersionFx"] = vi.fn(
		(request) =>
			Effect.sync(() => events.push(`checkout-${request.expectedFingerprint}`)).pipe(
				Effect.andThen(
					fail
						? Effect.fail(
								new EditorProjectRepositoryError({
									operation: "checkout-version",
									message: "Checkout rejected.",
								}),
							)
						: Effect.void,
				),
			),
	);
	const repository: EditorProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.sync(() => events.push("idle")),
		checkoutVersionFx,
		createProjectFx: () => Effect.die("Unexpected project create."),
		listProjectsFx: Effect.die("Unexpected project list."),
		readProjectFx: () =>
			Effect.sync(() => {
				events.push("project-read");
				return {
					...project,
					revision: 7,
				};
			}),
		readVersionStatusFx: () =>
			Effect.sync(() => {
				events.push("status");
				return {
					canCommit: true,
					currentFingerprint: "a".repeat(64),
					dirty,
					versionCount: 1,
				};
			}),
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
			hasDirtySession: false,
			promptOpen: false,
			saving: false,
		}),
		refresh: () => undefined,
		register: () => () => undefined,
		requestLeave: async () => true,
		subscribe: () => () => undefined,
	};
	try {
		const exit = await Effect.runPromiseExit(
			checkoutEditorProjectVersionFx({
				confirmDiscardCurrentChanges: confirm,
				projectId: project.projectId,
				versionId: "version-one",
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
		registry.dispose();
	}
};

describe("checkoutEditorProjectVersionFx", () => {
	it("discards drafts only after replacing persisted state", async () => {
		const result = await runCheckout();
		expect(Exit.isSuccess(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"status",
			"board-release",
			`checkout-${"a".repeat(64)}`,
			"discard",
			"project-read",
			"board-sync-7",
		]);
		expect(result.published?.revision).toBe(7);
		expect(result.replacementEpoch).toBe(1);
	});

	it("requires fresh consent before discarding newly saved working-copy changes", async () => {
		const result = await runCheckout({
			confirm: false,
			dirty: true,
		});
		expect(Exit.isFailure(result.exit)).toBe(true);
		if (Exit.isFailure(result.exit)) {
			const failure = Cause.findErrorOption(result.exit.cause);
			expect(Option.isSome(failure)).toBe(true);
			if (Option.isSome(failure))
				expect(failure.value).toBeInstanceOf(
					EditorProjectVersionCheckoutConfirmationRequired,
				);
		}
		expect(result.events).toEqual([
			"idle",
			"status",
		]);
	});

	it("resynchronizes the untouched project after a failed replacement", async () => {
		const result = await runCheckout({
			fail: true,
		});
		expect(Exit.isFailure(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"status",
			"board-release",
			`checkout-${"a".repeat(64)}`,
			"project-read",
			"board-sync-7",
		]);
		expect(result.replacementEpoch).toBe(0);
	});
});
