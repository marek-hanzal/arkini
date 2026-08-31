import { scheduleTask } from "@effect/atom-react";
import { Effect, Exit, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import type { EditorBoardGameResource } from "~/board-scenario/service/EditorBoardGameResource";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import { restoreBoardScenarioFx } from "~/board-scenario/fx/restoreBoardScenarioFx";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project: Project = {
	projectId: "editor-board",
	title: editorTestPayload.config.meta.title,
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 3,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const state: StateSchema.Type = {
	cheats: {
		enabled: true,
		everEnabled: true,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [],
	jobs: [],
	jobQueue: [],
};

const runRestore = async ({
	bytes,
	replaceFx,
	version = project.version,
	projectVersion = project.version,
}: {
	readonly bytes: Uint8Array;
	readonly replaceFx: EditorBoardGameResource["replaceFx"];
	readonly version?: string;
	readonly projectVersion?: string;
}) => {
	const restoredProject = {
		...project,
		version: projectVersion,
	};
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	const owner = {
		state: Effect.runSync(
			SubscriptionRef.make<EditorBoardGameResource.State>({
				type: "idle",
			}),
		),
		syncFx: () => Effect.void,
		publishFx: () => Effect.void,
		replaceFx,
		releaseCurrentFx: Effect.void,
		shutdownFx: Effect.void,
	} satisfies EditorBoardGameResource;
	Effect.runSync(
		Atom.set(EditorBoardGameResourceOwnerAtom, owner).pipe(
			Effect.provideService(AtomRegistry.AtomRegistry, registry),
		),
	);
	const deleteBoardScenarioFx = vi.fn(() => Effect.void);
	const repository: ProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected create."),
		listProjectsFx: Effect.die("Unexpected project list."),
		readProjectFx: () => Effect.die("Unexpected project read."),
		readBoardScenarioFx: () =>
			Effect.succeed({
				projectId: project.projectId,
				name: "Scenario",
				projectRevision: project.revision,
				version,
				bytes: Uint8Array.from(bytes),
				createdAtMs: 1,
				updatedAtMs: 1,
			}),
		replaceConfigFx: () => Effect.die("Unexpected config write."),
		replaceResourceFx: () => Effect.die("Unexpected resource write."),
		deleteItemFx: () => Effect.die("Unexpected item delete."),
		upsertItemFx: () => Effect.die("Unexpected item write."),
		upsertResourcesFx: () => Effect.die("Unexpected resources write."),
		deleteBoardScenarioFx,
	};
	try {
		const result = await Effect.runPromiseExit(
			restoreBoardScenarioFx({
				project: restoredProject,
				name: "Scenario",
			}).pipe(
				Effect.provideService(ProjectRepository, repository),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		return {
			result,
			deleteBoardScenarioFx,
			restoredProject,
		};
	} finally {
		registry.dispose();
	}
};

describe("restoreBoardScenarioFx", () => {
	it("rejects invalid scenario bytes without deleting or replacing them", async () => {
		const replaceFx = vi.fn<EditorBoardGameResource["replaceFx"]>(() => Effect.void);
		const { result, deleteBoardScenarioFx } = await runRestore({
			bytes: new Uint8Array([
				255,
			]),
			replaceFx,
		});

		expect(Exit.isSuccess(result)).toBe(true);
		if (Exit.isFailure(result)) throw new Error("Expected invalid scenario recovery.");
		expect(result.value.type).toBe("rejected");
		expect(deleteBoardScenarioFx).not.toHaveBeenCalled();
		expect(replaceFx).not.toHaveBeenCalled();
	});

	it.each([
		{
			version: "1.0",
			projectVersion: "1.1",
		},
		{
			version: "1.1",
			projectVersion: "1.0",
		},
	])(
		"restores gameplay $version against same-major project $projectVersion",
		async (versions) => {
			const bytes = encodeArkiniSaveFn({
				version: versions.version,
				state,
			});
			const replaceFx = vi.fn<EditorBoardGameResource["replaceFx"]>(() => Effect.void);
			const { result, deleteBoardScenarioFx, restoredProject } = await runRestore({
				bytes,
				replaceFx,
				...versions,
			});

			expect(Exit.isSuccess(result)).toBe(true);
			if (Exit.isFailure(result)) throw new Error("Expected same-major scenario restore.");
			expect(result.value.type).toBe("restored");
			expect(deleteBoardScenarioFx).not.toHaveBeenCalled();
			expect(replaceFx).toHaveBeenCalledWith(restoredProject, state);
		},
	);

	it("rejects a different gameplay major without deleting it", async () => {
		const bytes = encodeArkiniSaveFn({
			version: "2.0",
			state,
		});
		const replaceFx = vi.fn<EditorBoardGameResource["replaceFx"]>(() => Effect.void);
		const { result, deleteBoardScenarioFx } = await runRestore({
			bytes,
			replaceFx,
			version: "2.0",
		});

		expect(Exit.isSuccess(result)).toBe(true);
		if (Exit.isFailure(result)) throw new Error("Expected incompatible scenario rejection.");
		expect(result.value.type).toBe("rejected");
		expect(deleteBoardScenarioFx).not.toHaveBeenCalled();
		expect(replaceFx).not.toHaveBeenCalled();
	});

	it("preserves a valid scenario when live session replacement fails", async () => {
		const bytes = encodeArkiniSaveFn({
			version: "1.0",
			state,
		});
		const replaceFx = vi.fn<EditorBoardGameResource["replaceFx"]>(() =>
			Effect.fail(new Error("resource URL allocation failed")),
		);
		const { result, deleteBoardScenarioFx } = await runRestore({
			bytes,
			replaceFx,
		});

		expect(Exit.isFailure(result)).toBe(true);
		expect(deleteBoardScenarioFx).not.toHaveBeenCalled();
		expect(replaceFx).toHaveBeenCalledWith(project, state);
	});
});
