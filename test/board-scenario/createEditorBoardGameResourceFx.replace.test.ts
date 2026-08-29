import { Effect, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorBoardGame } from "~/board-scenario/session/EditorBoardGame";
import { createEditorBoardGameResourceFx } from "~/board-scenario/session/createEditorBoardGameResourceFx";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";
import type { StateSchema } from "~/game-persistence/StateSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

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
	it.effect("disposes the live session before creating a same-revision scenario session", () =>
		Effect.gen(function* () {
			const events: string[] = [];
			const createResourceFx = vi.fn(
				(ownedProject: EditorProject, restored?: StateSchema.Type) =>
					Effect.sync(() => {
						events.push(restored === undefined ? "create-fresh" : "create-restored");
						return createResource(
							ownedProject,
							Effect.sync(() => {
								events.push(
									restored === undefined ? "dispose-fresh" : "dispose-restored",
								);
							}),
						);
					}),
			);
			const owner = yield* createEditorBoardGameResourceFx({
				createResourceFx,
			});

			yield* owner.syncFx(project);
			yield* owner.replaceFx(project, state);

			expect(events).toEqual([
				"create-fresh",
				"dispose-fresh",
				"create-restored",
			]);
			expect(createResourceFx).toHaveBeenLastCalledWith(project, state);
			const current = yield* SubscriptionRef.get(owner.state);
			expect(current.type).toBe("ready");
			yield* owner.releaseCurrentFx;
		}),
	);

	it.effect("rejects a stale restore without replacing the newer routed revision", () =>
		Effect.gen(function* () {
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
			const owner = yield* createEditorBoardGameResourceFx({
				createResourceFx,
			});
			const newerProject = {
				...project,
				revision: project.revision + 1,
			};

			yield* owner.syncFx(project);
			yield* owner.publishFx(newerProject);
			const failure = yield* Effect.flip(owner.replaceFx(project, state));
			expect(failure).toBeInstanceOf(Error);
			expect((failure as Error).message).toContain("is no longer active");

			expect(createResourceFx).toHaveBeenCalledTimes(2);
			expect(events).toEqual([
				`dispose-${project.revision}`,
			]);
			const current = yield* SubscriptionRef.get(owner.state);
			expect(current.type).toBe("ready");
			if (current.type !== "ready") throw new Error("Expected the newer editor game.");
			expect(current.resource.game.projectRevision).toBe(newerProject.revision);
			yield* owner.releaseCurrentFx;
		}),
	);

	it.effect("rejects restore after route release without recreating the editor game", () =>
		Effect.gen(function* () {
			const createResourceFx = vi.fn((ownedProject: EditorProject) =>
				Effect.succeed(createResource(ownedProject, Effect.void)),
			);
			const owner = yield* createEditorBoardGameResourceFx({
				createResourceFx,
			});

			yield* owner.syncFx(project);
			yield* owner.releaseCurrentFx;
			const failure = yield* Effect.flip(owner.replaceFx(project, state));
			expect(failure).toBeInstanceOf(Error);
			expect((failure as Error).message).toContain("is no longer active");

			expect(createResourceFx).toHaveBeenCalledTimes(1);
			expect(yield* SubscriptionRef.get(owner.state)).toEqual({
				type: "idle",
			});
		}),
	);
});
