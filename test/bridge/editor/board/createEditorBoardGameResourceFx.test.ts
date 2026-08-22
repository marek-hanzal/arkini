import { Deferred, Effect, Fiber, SubscriptionRef } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { createEditorBoardGameFx } from "~/bridge/editor/board/createEditorBoardGameFx";
import { createEditorBoardGameResourceFx } from "~/bridge/editor/board/createEditorBoardGameResourceFx";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createProject = (revision: number): EditorProject => ({
	projectId: "editor-board",
	title: editorTestPayload.config.meta.title,
	game: editorTestPayload.config.version,
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
	it("publishes a replacement only after the exact previous revision is discarded", async () => {
		const releaseGate = Effect.runSync(Deferred.make<void>());
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
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);

		await Effect.runPromise(owner.syncFx(createProject(1)));
		await Effect.runPromise(owner.syncFx(createProject(1)));
		const replacement = Effect.runFork(owner.syncFx(createProject(2)));
		await vi.waitFor(() => expect(events).toContain("release-start-1"));

		expect(events).toEqual([
			"create-1",
			"release-start-1",
		]);
		expect(await Effect.runPromise(SubscriptionRef.get(owner.state))).toEqual({
			type: "loading",
			projectId: "editor-board",
			projectRevision: 2,
		});

		Effect.runSync(Deferred.succeed(releaseGate, undefined));
		await Effect.runPromise(Fiber.join(replacement));
		const state = await Effect.runPromise(SubscriptionRef.get(owner.state));
		expect(state.type).toBe("ready");
		if (state.type !== "ready") throw new Error("Replacement editor game is missing.");
		expect(state.resource.game.projectRevision).toBe(2);
		expect(events).toEqual([
			"create-1",
			"release-start-1",
			"create-2",
		]);

		await Effect.runPromise(owner.releaseCurrentFx);
		await Effect.runPromise(owner.releaseCurrentFx);
		expect(events).toEqual([
			"create-1",
			"release-start-1",
			"create-2",
			"release-2",
		]);
	});

	it("keeps a failed disposal visible and retries it before creating the next revision", async () => {
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
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);

		await Effect.runPromise(owner.syncFx(createProject(1)));
		await Effect.runPromise(owner.syncFx(createProject(2)));
		const failed = await Effect.runPromise(SubscriptionRef.get(owner.state));
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

		await Effect.runPromise(owner.syncFx(createProject(1)));
		expect(await Effect.runPromise(SubscriptionRef.get(owner.state))).toEqual(failed);
		expect(created).toEqual([
			1,
		]);

		await Effect.runPromise(owner.syncFx(createProject(2)));
		const recovered = await Effect.runPromise(SubscriptionRef.get(owner.state));
		expect(recovered.type).toBe("ready");
		if (recovered.type !== "ready") throw new Error("Recovered editor game is missing.");
		expect(recovered.resource.game.projectRevision).toBe(2);
		expect(created).toEqual([
			1,
			2,
		]);
		expect(revokeObjectUrl).toHaveBeenCalledTimes(2);

		await Effect.runPromise(owner.releaseCurrentFx);
	});

	it("keeps a failed newer creation visible when a stale revision arrives", async () => {
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
		const owner = await Effect.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx,
			}),
		);

		await Effect.runPromise(owner.syncFx(createProject(1)));
		await Effect.runPromise(owner.syncFx(createProject(2)));
		const failed = await Effect.runPromise(SubscriptionRef.get(owner.state));
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

		await Effect.runPromise(owner.syncFx(createProject(1)));
		expect(await Effect.runPromise(SubscriptionRef.get(owner.state))).toEqual(failed);
		expect(created).toEqual([
			1,
			2,
		]);

		await Effect.runPromise(owner.syncFx(createProject(2)));
		const recovered = await Effect.runPromise(SubscriptionRef.get(owner.state));
		expect(recovered.type).toBe("ready");
		if (recovered.type !== "ready") throw new Error("Revision 2 did not recover.");
		expect(recovered.resource.game.projectRevision).toBe(2);
		expect(created).toEqual([
			1,
			2,
			2,
		]);

		await Effect.runPromise(owner.releaseCurrentFx);
	});
});
