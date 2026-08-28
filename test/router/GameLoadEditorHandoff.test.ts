// @vitest-environment jsdom

import { Deferred, Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";
import { createEditorBoardGameFx } from "~/bridge/editor/board/createEditorBoardGameFx";
import { createEditorBoardGameResourceFx } from "~/bridge/editor/board/createEditorBoardGameResourceFx";
import { publishEditorProjectFx } from "~/bridge/editor/publishEditorProjectFx";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createGame,
	createGameFxMock,
	createHarness,
	installEditorBoardGameOwner,
	packageId,
	renderRouter,
	setUpGameLoadRouteTest,
	tearDownGameLoadRouteTest,
} from "~test/router/GameLoadRouteLifecycle.test/fixture";

beforeEach(setUpGameLoadRouteTest);
afterEach(tearDownGameLoadRouteTest);

describe("game load editor handoff", () => {
	it("rejects a delayed Editor publication after installed Play owns the process", async () => {
		const project: EditorProject = {
			projectId: "delayed-editor-project",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 1,
			revision: 1,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		};
		const installedGame = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(installedGame));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const createEditorResourceFx = vi.fn((candidate: EditorProject) =>
			createEditorBoardGameFx({
				project: candidate,
			}).pipe(Effect.flatMap((game) => createGameEngineResourceFx(game))),
		);
		const editorOwner = await rendererRuntime.runPromise(
			createEditorBoardGameResourceFx({
				createResourceFx: createEditorResourceFx,
			}),
		);
		rendererRuntime.runSync(Atom.set(EditorBoardGameResourceOwnerAtom, editorOwner));
		await rendererRuntime.runPromise(editorOwner.syncFx(project));
		const writeFinished = Effect.runSync(Deferred.make<void>());
		const committedProject = {
			...project,
			updatedAtMs: 2,
			revision: 2,
		};
		const delayedPublication = rendererRuntime.runPromise(
			Deferred.await(writeFinished).pipe(
				Effect.andThen(
					publishEditorProjectFx(project.projectId, {
						project: committedProject,
					}),
				),
			),
		);

		const loading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack).toBe(
			installedGame.arkpack,
		);

		Effect.runSync(Deferred.succeed(writeFinished, undefined));
		await delayedPublication;

		expect(
			await rendererRuntime.runPromise(Atom.get(EditorProjectAtom(project.projectId))),
		).toEqual(committedProject);
		expect(await rendererRuntime.runPromise(SubscriptionRef.get(editorOwner.state))).toEqual({
			type: "idle",
		});
		expect(createEditorResourceFx).toHaveBeenCalledOnce();
	});

	it("waits for editor-game disposal before creating the installed Game", async () => {
		const releaseStarted = Effect.runSync(Deferred.make<void>());
		const releaseGate = Effect.runSync(Deferred.make<void>());
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		installEditorBoardGameOwner(
			rendererRuntime,
			Deferred.succeed(releaseStarted, undefined).pipe(
				Effect.andThen(Deferred.await(releaseGate)),
			),
		);

		const loading = router.load();
		await Effect.runPromise(Deferred.await(releaseStarted));

		expect(createGameFxMock).not.toHaveBeenCalled();
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();

		Effect.runSync(Deferred.succeed(releaseGate, undefined));
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;

		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack).toBe(
			game.arkpack,
		);
	});

	it("refuses package creation after failed editor disposal and permits a clean retry", async () => {
		const releaseError = new Error("editor disposal failed");
		const game = createGame();
		let releaseAttempts = 0;
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		installEditorBoardGameOwner(
			rendererRuntime,
			Effect.suspend(() => {
				releaseAttempts += 1;
				return releaseAttempts === 1 ? Effect.fail(releaseError) : Effect.void;
			}),
		);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;
		const container = await renderRouter(router);

		expect(createGameFxMock).not.toHaveBeenCalled();
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		expect(container.querySelector('[data-ui="ActionErrorPage"]')).not.toBeNull();

		await act(async () => {
			await router.navigate({
				to: "/main-menu",
				replace: true,
			});
			const retry = router.navigate({
				to: "/action/load-game/$packageId",
				params: {
					packageId,
				},
				replace: true,
			});
			await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
			await vi.advanceTimersByTimeAsync(2_500);
			await retry;
		});

		expect(releaseAttempts).toBe(2);
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack).toBe(
			game.arkpack,
		);
	});
});
