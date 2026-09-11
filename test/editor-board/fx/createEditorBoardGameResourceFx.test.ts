import { Deferred, Effect, Fiber, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { afterEach, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/editor-board/type/EditorBoardGame";
import { createEditorBoardGameFx } from "~/editor-board/fx/createEditorBoardGameFx";
import { createEditorBoardGameResourceFx } from "~/editor-board/fx/createEditorBoardGameResourceFx";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import { createGameEngineResourceFx } from "~/playable-game/fx/createGameEngineResourceFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const createProject = (revision: number): Project => ({
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

describe("Board Scenario createEditorBoardGameResourceFx", () => {
	it.effect("publishes a replacement only after the exact previous revision is discarded", () =>
		Effect.gen(function* () {
			const releaseGate = yield* Deferred.make<void>();
			const releaseEntered = yield* Deferred.make<void>();
			const events: string[] = [];
			const createResourceFx = (project: Project) =>
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

	it.effect("advances a version-noop revision without replacing the game session", () =>
		Effect.gen(function* () {
			const created: number[] = [];
			const released: number[] = [];
			const createResourceFx = (project: Project) =>
				Effect.gen(function* () {
					created.push(project.revision);
					const game = yield* createEditorBoardGameFx({
						project,
					});
					const resource = yield* createGameEngineResourceFx(game);
					const disposeWithoutSaveFx = Effect.sync(() => {
						released.push(project.revision);
					}).pipe(Effect.andThen(game.disposeWithoutSaveFx));
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
			const before = yield* SubscriptionRef.get(owner.state);
			if (before.type !== "ready") throw new Error("Initial editor game is missing.");
			const water = editorTestPayload.config.items.water;
			if (water === undefined) throw new Error("Missing water fixture.");
			const project = {
				...createProject(2),
				config: {
					...editorTestPayload.config,
					items: {
						...editorTestPayload.config.items,
						water: {
							...water,
							draft: true,
						},
					},
				},
			};

			yield* owner.advanceNoopFx(project, 1);

			const after = yield* SubscriptionRef.get(owner.state);
			if (after.type !== "ready") throw new Error("Advanced editor game is missing.");
			expect(created).toEqual([
				1,
			]);
			expect(released).toEqual([]);
			expect(after.resource.game.projectRevision).toBe(2);
			expect(after.resource.game.config.items.water?.draft).toBe(true);
			expect(after.resource.game.runFx).toBe(before.resource.game.runFx);

			yield* owner.releaseCurrentFx;
			expect(released).toEqual([
				1,
			]);
		}),
	);

	it.effect("rebuilds when a version-noop does not follow the running revision", () =>
		Effect.gen(function* () {
			const created: number[] = [];
			const released: number[] = [];
			const createResourceFx = (project: Project) =>
				Effect.gen(function* () {
					created.push(project.revision);
					const game = yield* createEditorBoardGameFx({
						project,
					});
					const resource = yield* createGameEngineResourceFx(game);
					const disposeWithoutSaveFx = Effect.sync(() => {
						released.push(project.revision);
					}).pipe(Effect.andThen(game.disposeWithoutSaveFx));
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

			yield* owner.advanceNoopFx(createProject(3), 2);

			const state = yield* SubscriptionRef.get(owner.state);
			expect(state.type).toBe("ready");
			if (state.type !== "ready") throw new Error("Rebuilt editor game is missing.");
			expect(state.resource.game.projectRevision).toBe(3);
			expect(created).toEqual([
				1,
				3,
			]);
			expect(released).toEqual([
				1,
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
				const createResourceFx = (project: Project) =>
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
			const createResourceFx = (project: Project) =>
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
