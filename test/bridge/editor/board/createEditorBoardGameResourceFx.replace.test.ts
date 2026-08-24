import { Effect, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { createEditorBoardGameResourceFx } from "~/bridge/editor/board/createEditorBoardGameResourceFx";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const project: EditorProject = {
	projectId: "editor-board",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 4,
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

const createResource = (
	ownedProject: EditorProject,
	disposeWithoutSaveFx: Effect.Effect<void>,
): GameEngineResource<EditorBoardGame> => ({
	game: {
		projectId: ownedProject.projectId,
		projectRevision: ownedProject.revision,
		disposeWithoutSaveFx,
	} as unknown as GameEngineResource<EditorBoardGame>["game"],
	assertUsable: () => undefined,
	getCriticalFailure: () => null,
	markCriticalFailure: () => {
		throw new Error("Unexpected critical failure.");
	},
	subscribeCriticalFailure: () => () => undefined,
});

describe("EditorBoardGameResource.replaceFx", () => {
	it("disposes the live session before creating a same-revision scenario session", async () => {
		const events: string[] = [];
		const createResourceFx = vi.fn((ownedProject: EditorProject, restored?: StateSchema.Type) =>
			Effect.sync(() => {
				events.push(restored === undefined ? "create-fresh" : "create-restored");
				return createResource(
					ownedProject,
					Effect.sync(() => {
						events.push(restored === undefined ? "dispose-fresh" : "dispose-restored");
					}),
				);
			}),
		);
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);

		await Effect.runPromise(owner.syncFx(project));
		await Effect.runPromise(owner.replaceFx(project, state));

		expect(events).toEqual([
			"create-fresh",
			"dispose-fresh",
			"create-restored",
		]);
		expect(createResourceFx).toHaveBeenLastCalledWith(project, state);
		const current = await Effect.runPromise(SubscriptionRef.get(owner.state));
		expect(current.type).toBe("ready");
		await Effect.runPromise(owner.releaseCurrentFx);
	});

	it("rejects a stale restore without replacing the newer routed revision", async () => {
		const events: string[] = [];
		const createResourceFx = vi.fn((ownedProject: EditorProject) =>
			Effect.succeed(
				createResource(
					ownedProject,
					Effect.sync(() => {
						events.push(`dispose-${ownedProject.revision}`);
					}),
				),
			),
		);
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);
		const newerProject = {
			...project,
			revision: project.revision + 1,
		};

		await Effect.runPromise(owner.syncFx(project));
		await Effect.runPromise(owner.publishFx(newerProject));
		await expect(Effect.runPromise(owner.replaceFx(project, state))).rejects.toThrow(
			"is no longer active",
		);

		expect(createResourceFx).toHaveBeenCalledTimes(2);
		expect(events).toEqual([
			`dispose-${project.revision}`,
		]);
		const current = await Effect.runPromise(SubscriptionRef.get(owner.state));
		expect(current.type).toBe("ready");
		if (current.type !== "ready") throw new Error("Expected the newer editor game.");
		expect(current.resource.game.projectRevision).toBe(newerProject.revision);
		await Effect.runPromise(owner.releaseCurrentFx);
	});

	it("rejects restore after route release without recreating the editor game", async () => {
		const createResourceFx = vi.fn((ownedProject: EditorProject) =>
			Effect.succeed(createResource(ownedProject, Effect.void)),
		);
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);

		await Effect.runPromise(owner.syncFx(project));
		await Effect.runPromise(owner.releaseCurrentFx);
		await expect(Effect.runPromise(owner.replaceFx(project, state))).rejects.toThrow(
			"is no longer active",
		);

		expect(createResourceFx).toHaveBeenCalledTimes(1);
		expect(await Effect.runPromise(SubscriptionRef.get(owner.state))).toEqual({
			type: "idle",
		});
	});
});
