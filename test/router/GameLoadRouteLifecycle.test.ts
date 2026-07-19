// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createGameFxMock = vi.hoisted(() => vi.fn());

vi.mock("~/bridge/game/createGameFx", () => ({
	createGameFx: createGameFxMock,
}));

import { routeTree } from "~/_route";
import type { Game } from "~/bridge/game/Game";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

const packageId = "package-route-load";

const createStartup = (): LauncherStartup => ({
	getSnapshot: () => ({
		type: "ready",
		appearance: {
			theme: "dark",
			accent: "rose",
		},
		builtInPackageId: packageId,
		heroReady: true,
		splashCompleted: true,
	}),
	startFx: Effect.void,
	retryFx: Effect.void,
	completeSplashFx: Effect.void,
	subscribe: () => () => undefined,
});

const createGame = (): Game => ({
	arkpack: {
		packageId,
		contentHash: "content-route-load",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		configVersion: testArkpackConfig.version,
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId,
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = (initialPath: string) => {
	const queryClient = new QueryClient();
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			launcherStartup: createStartup(),
			previousGameShutdown: Promise.resolve(),
			queryClient,
		},
		history: createMemoryHistory({
			initialEntries: [
				initialPath,
			],
		}),
	});
	return {
		queryClient,
		router,
	};
};

beforeEach(() => {
	vi.useFakeTimers();
	createGameFxMock.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("game load action lifecycle", () => {
	it("creates one stable Game before redirecting the explicit load action to Board", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { queryClient, router } = createHarness(`/action/load-game/${packageId}`);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(getCachedGameEngineResource(queryClient)?.game).toBe(game);
	});

	it("repairs a direct Board entry through the same explicit load action", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { queryClient, router } = createHarness(`/game/${packageId}/board`);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(getCachedGameEngineResource(queryClient)?.game).toBe(game);
	});
});
