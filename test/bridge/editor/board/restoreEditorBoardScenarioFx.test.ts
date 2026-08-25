import { scheduleTask } from "@effect/atom-react";
import { Effect, Exit, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import {
	type EditorBoardGameResource,
	EditorBoardGameResourceOwnerAtom,
} from "~/bridge/editor/board/EditorBoardGameResource";
import { restoreEditorBoardScenarioFx } from "~/bridge/editor/board/restoreEditorBoardScenarioFx";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project: EditorProject = {
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
}: {
	readonly bytes: Uint8Array;
	readonly replaceFx: EditorBoardGameResource["replaceFx"];
}) => {
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
	const repository: EditorProjectRepositoryService = {
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
				version: project.version,
				bytes: Uint8Array.from(bytes),
				createdAtMs: 1,
				updatedAtMs: 1,
			}),
		replaceConfigFx: () => Effect.die("Unexpected config write."),
		replaceResourceFx: () => Effect.die("Unexpected resource write."),
		upsertItemFx: () => Effect.die("Unexpected item write."),
		upsertResourcesFx: () => Effect.die("Unexpected resources write."),
		deleteBoardScenarioFx,
	};
	try {
		const result = await Effect.runPromiseExit(
			restoreEditorBoardScenarioFx({
				project,
				name: "Scenario",
			}).pipe(
				Effect.provideService(EditorProjectRepository, repository),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		return {
			result,
			deleteBoardScenarioFx,
		};
	} finally {
		registry.dispose();
	}
};

describe("restoreEditorBoardScenarioFx", () => {
	it("deletes a proven-invalid scenario and replaces it with a fresh session", async () => {
		const replaceFx = vi.fn<EditorBoardGameResource["replaceFx"]>(() => Effect.void);
		const { result, deleteBoardScenarioFx } = await runRestore({
			bytes: new Uint8Array([
				255,
			]),
			replaceFx,
		});

		expect(Exit.isSuccess(result)).toBe(true);
		if (Exit.isFailure(result)) throw new Error("Expected invalid scenario recovery.");
		expect(result.value.type).toBe("discarded");
		expect(deleteBoardScenarioFx).toHaveBeenCalledWith({
			projectId: project.projectId,
			name: "Scenario",
		});
		expect(replaceFx).toHaveBeenCalledWith(project, undefined);
	});

	it("preserves a valid scenario when live session replacement fails", async () => {
		const bytes = await Effect.runPromise(
			encodeArkiniSaveFx({
				version: "1.0",
				state,
			}),
		);
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
