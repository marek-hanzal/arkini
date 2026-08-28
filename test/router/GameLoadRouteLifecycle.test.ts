// @vitest-environment jsdom

import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import {
	createGame,
	createGameFxMock,
	createHarness,
	loadRoute,
	packageId,
	setUpGameLoadRouteTest,
	tearDownGameLoadRouteTest,
	waitForEffectSettlement,
} from "~test/router/GameLoadRouteLifecycle.test/fixture";

beforeEach(setUpGameLoadRouteTest);
afterEach(tearDownGameLoadRouteTest);

describe("game load action lifecycle", () => {
	it("creates one stable Game before redirecting the explicit load action to Board", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.session.arkpack).toBe(
			game.arkpack,
		);
	});

	it("repairs a direct Board entry through the same explicit load action", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/game/${packageId}/board`);

		await loadRoute(router);

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.session.arkpack).toBe(
			game.arkpack,
		);
	});

	it("cancels an unfinished route-owned creation when navigation leaves the load action", async () => {
		const interrupted = vi.fn();
		createGameFxMock.mockReturnValue(
			Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const loading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());

		await act(async () => {
			const navigation = router.navigate({
				to: "/main-menu",
				replace: true,
			});
			await Promise.resolve();
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});
		await loading;

		expect(router.state.location.pathname).toBe("/main-menu");
		await waitForEffectSettlement(() => expect(interrupted).toHaveBeenCalledOnce());
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
	});

	it("keeps a completed Game provisional and discards it when the load action leaves during its hold", async () => {
		const discard = vi.fn();
		createGameFxMock.mockReturnValue(
			Effect.succeed(
				createGame({
					disposeWithoutSaveFx: Effect.sync(discard),
				}),
			),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const loading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();

		await act(async () => {
			const navigation = router.navigate({
				to: "/main-menu",
				replace: true,
			});
			await Promise.resolve();
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});
		await loading;

		expect(router.state.location.pathname).toBe("/main-menu");
		await waitForEffectSettlement(() => expect(discard).toHaveBeenCalledOnce());
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
	});

	it("replaces a pending different-package creation without joining or poisoning either resource", async () => {
		const nextPackageId = "package-route-load-next";
		createGameFxMock.mockReturnValueOnce(Effect.never).mockReturnValueOnce(
			Effect.succeed(
				createGame({
					createdPackageId: nextPackageId,
				}),
			),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const firstLoading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());

		await act(async () => {
			const navigation = router.navigate({
				to: "/action/load-game/$packageId",
				params: {
					packageId: nextPackageId,
				},
				replace: true,
			});
			await Promise.resolve();
			await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledTimes(2));
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});
		await firstLoading;

		expect(createGameFxMock).toHaveBeenCalledTimes(2);
		expect(router.state.location.pathname).toBe(`/game/${nextPackageId}/board`);
		expect(
			rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.session.arkpack.packageId,
		).toBe(nextPackageId);
	});
});
