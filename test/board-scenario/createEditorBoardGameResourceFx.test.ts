import { Deferred, Effect, Fiber, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { afterEach, vi } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { EditorBoardGame } from "~/board-scenario/session/EditorBoardGame";
import { createEditorBoardGameFx } from "~/board-scenario/session/createEditorBoardGameFx";
import { createEditorBoardGameResourceFx } from "~/board-scenario/session/createEditorBoardGameResourceFx";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";
import { createGameEngineResourceFx } from "~/renderer/game/resource/createGameEngineResourceFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const createProject = (revision: number): EditorProject => ({
	projectId: "editor-board",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createEditorBoardGameResourceFx", () => {
	it.effect("publishes a replacement only after the exact previous revision is discarded", () =>
		Effect.gen(function* () {
			const releaseGate = yield* Deferred.make<void>();
			const releaseEntered = yield* Deferred.make<void>();
			const events: string[] = [];
			const createResourceFx = (project: EditorProject) =>
				Effect.gen(function* () {
					events.push(`create-${project.revision}`);
					const game = yield* createEditorBoardGameFx({
						project,
					});
					const resource = yield* createGameEngineResourceFx(game);
					if (project.revision !== 1) {
						const disposeWithoutSaveFx = Effect.sync(() => {
							events.push(`release-${project.revision}`);
						}).pipe(Effect.andThen(game.disposeWithoutSaveFx));
						return {
							...resource,
							game: {
								...resource.game,
								disposeFx: disposeWithoutSaveFx,
								disposeWithoutSaveFx,
							},
						} satisfies GameEngineResource<EditorBoardGame>;
					}
					const disposeWithoutSaveFx = Effect.sync(() => {
						events.push("release-start-1");
					}).pipe(
						Effect.andThen(Deferred.succeed(releaseEntered, undefined)),
						Effect.andThen(Deferred.await(releaseGate)),
						Effect.andThen(game.disposeWithoutSaveFx),
					);
					return {
						...resource,
						game: {
							...resource.game,
							disposeFx: disposeWithoutSaveFx,
							disposeWithoutSaveFx,
						},
					} satisfies GameEngineResource<EditorBoardGame>;
				});
			const owner = yield* createEditorBoardGameResourceFx({
				createResourceFx,
			});

			yield* owner.syncFx(createProject(1));
			yield* owner.syncFx(createProject(1));
			const replacement = yield* owner.syncFx(createProject(2)).pipe(Effect.forkChild);
			yield* Deferred.await(releaseEntered);

			expect(events).toEqual([
				"create-1",
				"release-start-1",
			]);
			expect(yield* SubscriptionRef.get(owner.state)).toEqual({
				type: "loading",
				projectId: "editor-board",
				projectRevision: 2,
			});

			yield* Deferred.succeed(releaseGate, undefined);
			yield* Fiber.join(replacement);
			const state = yield* SubscriptionRef.get(owner.state);
			expect(state.type).toBe("ready");
			if (state.type !== "ready") throw new Error("Replacement editor game is missing.");
			expect(state.resource.game.projectRevision).toBe(2);
			expect(events).toEqual([
				"create-1",
				"release-start-1",
				"create-2",
			]);

			yield* owner.releaseCurrentFx;
			yield* owner.releaseCurrentFx;
			expect(events).toEqual([
				"create-1",
				"release-start-1",
				"create-2",
				"release-2",
			]);
		}),
	);

	it.effect(
		"keeps a failed disposal visible and retries it before creating the next revision",
		() =>
			Effect.gen(function* () {
				const disposalError = new Error("revision disposal failed");
				const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
				const created: number[] = [];
				let failFirstDisposal = true;
				const createResourceFx = (project: EditorProject) =>
					Effect.gen(function* () {
						created.push(project.revision);
						const game = yield* createEditorBoardGameFx({
							project,
						});
						const resource = yield* createGameEngineResourceFx(game);
						if (project.revision !== 1) return resource;
						const disposeWithoutSaveFx = Effect.suspend(() => {
							if (failFirstDisposal) {
								failFirstDisposal = false;
								return Effect.fail(disposalError);
							}
							return game.disposeWithoutSaveFx;
						});
						return {
							...resource,
							game: {
								...resource.game,
								disposeFx: disposeWithoutSaveFx,
								disposeWithoutSaveFx,
							},
						} satisfies GameEngineResource<EditorBoardGame>;
					});
				const owner = yield* createEditorBoardGameResourceFx({
					createResourceFx,
				});

				yield* owner.syncFx(createProject(1));
				yield* owner.syncFx(createProject(2));
				const failed = yield* SubscriptionRef.get(owner.state);
				expect(failed).toEqual({
					type: "failed",
					projectId: "editor-board",
					projectRevision: 2,
					error: disposalError,
				});
				expect(created).toEqual([
					1,
				]);
				expect(revokeObjectUrl).not.toHaveBeenCalled();

				yield* owner.syncFx(createProject(1));
				expect(yield* SubscriptionRef.get(owner.state)).toEqual(failed);
				expect(created).toEqual([
					1,
				]);

				yield* owner.syncFx(createProject(2));
				const recovered = yield* SubscriptionRef.get(owner.state);
				expect(recovered.type).toBe("ready");
				if (recovered.type !== "ready")
					throw new Error("Recovered editor game is missing.");
				expect(recovered.resource.game.projectRevision).toBe(2);
				expect(created).toEqual([
					1,
					2,
				]);
				expect(revokeObjectUrl).toHaveBeenCalledTimes(2);

				yield* owner.releaseCurrentFx;
			}),
	);

	it.effect("keeps a failed newer creation visible when a stale revision arrives", () =>
		Effect.gen(function* () {
			const creationError = new Error("revision creation failed");
			const created: number[] = [];
			let failRevisionTwo = true;
			const createResourceFx = (project: EditorProject) =>
				Effect.gen(function* () {
					created.push(project.revision);
					if (project.revision === 2 && failRevisionTwo) {
						failRevisionTwo = false;
						return yield* Effect.fail(creationError);
					}
					const game = yield* createEditorBoardGameFx({
						project,
					});
					return yield* createGameEngineResourceFx(game);
				});
			const owner = yield* createEditorBoardGameResourceFx({
				createResourceFx,
			});

			yield* owner.syncFx(createProject(1));
			yield* owner.syncFx(createProject(2));
			const failed = yield* SubscriptionRef.get(owner.state);
			expect(failed).toEqual({
				type: "failed",
				projectId: "editor-board",
				projectRevision: 2,
				error: creationError,
			});
			expect(created).toEqual([
				1,
				2,
			]);

			yield* owner.syncFx(createProject(1));
			expect(yield* SubscriptionRef.get(owner.state)).toEqual(failed);
			expect(created).toEqual([
				1,
				2,
			]);

			yield* owner.syncFx(createProject(2));
			const recovered = yield* SubscriptionRef.get(owner.state);
			expect(recovered.type).toBe("ready");
			if (recovered.type !== "ready") throw new Error("Revision 2 did not recover.");
			expect(recovered.resource.game.projectRevision).toBe(2);
			expect(created).toEqual([
				1,
				2,
				2,
			]);

			yield* owner.releaseCurrentFx;
		}),
	);
});
