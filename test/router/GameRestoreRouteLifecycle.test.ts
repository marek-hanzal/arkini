// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import {
	createGame,
	createGameFxMock,
	createHarness,
	loadRoute,
	packageId,
	setUpGameLoadRouteTest,
	tearDownGameLoadRouteTest,
} from "~test/router/GameLoadRouteLifecycle.test/fixture";

beforeEach(setUpGameLoadRouteTest);
afterEach(tearDownGameLoadRouteTest);

describe("selected save route lifecycle", () => {
	it("discards without saving, promotes the selected snapshot, then acquires a fresh game", async () => {
		const calls: string[] = [];
		const first = {
			...createGame(),
			disposeFx: Effect.sync(() => {
				calls.push("save");
			}),
			disposeWithoutSaveFx: Effect.sync(() => {
				calls.push("discard");
			}),
			prepareRestoreFx: (slot: string) =>
				Effect.sync(() => {
					calls.push(slot);
					return Effect.sync(() => {
						calls.push("promote");
					});
				}),
		};
		const restored = createGame();
		createGameFxMock.mockReturnValueOnce(Effect.succeed(first)).mockImplementation(() =>
			Effect.sync(() => {
				calls.push("acquire");
				return restored;
			}),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		await loadRoute(router);
		const navigation = router.navigate({
			to: "/game/$packageId/action/load",
			params: {
				packageId,
			},
			search: {
				slot: "30-min",
			},
		});
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(5_000);
		await navigation;
		expect(calls).toEqual([
			"30-min",
			"discard",
			"promote",
			"acquire",
		]);
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(
			rendererRuntime.runSync(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			)?.game.serapack,
		).toBe(restored.serapack);
	});

	it("keeps the active resource available when the selected save fails validation", async () => {
		const dispose = vi.fn();
		const game = {
			...createGame(),
			disposeFx: Effect.sync(dispose),
			disposeWithoutSaveFx: Effect.sync(dispose),
			prepareRestoreFx: () => Effect.fail(new Error("Invalid selected save")),
		};
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		await loadRoute(router);
		const navigation = router.navigate({
			to: "/game/$packageId/action/load",
			params: {
				packageId,
			},
			search: {
				slot: "manual",
			},
		});
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(2_500);
		await navigation;
		expect(router.state.matches.at(-1)?.status).toBe("error");
		expect(dispose).not.toHaveBeenCalled();
		expect(
			rendererRuntime.runSync(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			)?.game.serapack,
		).toBe(game.serapack);
		await router.navigate({
			to: "/game/$packageId/board",
			params: {
				packageId,
			},
			replace: true,
		});
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(createGameFxMock).toHaveBeenCalledOnce();
	});
});
