// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { createTestGameTransitionFields } from "~test/support/game/createTestGameTransitionFields";
import { testGameRead } from "~test/support/game/testGameRead";

const createStartup = (): LauncherStartup => ({
	getSnapshot: () => ({
		type: "ready",
		appearance: {
			theme: "dark",
			accent: "rose",
		},
		builtInPackageId: "built-in",
		cheatsAvailable: false,
		heroReady: true,
		splashCompleted: true,
	}),
	startFx: Effect.void,
	retryFx: Effect.void,
	completeSplashFx: Effect.void,
	subscribe: () => () => undefined,
});

const createGame = (disposeFx: Game["disposeFx"] = Effect.void): Game => ({
	arkpack: {
		packageId: "package-route",
		contentHash: "content-route",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		configVersion: testArkpackConfig.version,
		compressedSize: 0,
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	...createTestGameTransitionFields(() => ({}) as ReturnType<Game["getSnapshot"]>),
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId: "package-route",
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = (
	initialPath: string,
	game: Game,
	{
		cheatsAvailable = false,
	}: {
		readonly cheatsAvailable?: boolean;
	} = {},
) => {
	const queryClient = new QueryClient();
	const cheatAvailability = createCheatAvailability();
	cheatAvailability.apply(cheatsAvailable);
	const resource = Effect.runSync(createGameEngineResourceFx(game));
	queryClient.setQueryData(gameEngineQueryKey, resource);
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			cheatAvailability,
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
		resource,
		router,
	};
};

afterEach(() => {
	vi.useRealTimers();
});

describe("game route lifecycle", () => {
	it("exposes the cached Game through the package loader without replacing its identity", async () => {
		const game = createGame();
		const { resource, router } = createHarness("/game/package-route/board", game);

		await router.load();
		const gameMatch = router.state.matches.find(
			(match) => match.routeId === "/game/$packageId",
		);

		expect(gameMatch?.loaderData).toBe(resource.game);
		expect(gameMatch?.context.gameEngine).toBe(resource.game);
		expect(gameMatch?.context.gameEngineResource).toBe(resource);
	});

	it("gates the save-scoped Cheats route only through application availability", async () => {
		const game = createGame();
		const unavailable = createHarness("/game/package-route/cheats", game);
		await unavailable.router.load();
		expect(unavailable.router.state.location.pathname).toBe("/game/package-route/board");

		const available = createHarness("/game/package-route/cheats", game, {
			cheatsAvailable: true,
		});
		await available.router.load();
		expect(available.router.state.location.pathname).toBe("/game/package-route/cheats");
	});

	it("preserves the cached Game while standalone Settings is open", async () => {
		vi.useFakeTimers();
		const dispose = vi.fn();
		const game = createGame(Effect.sync(dispose));
		const { queryClient, router } = createHarness("/settings", game);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;

		expect(router.state.location.pathname).toBe("/settings");
		expect(dispose).not.toHaveBeenCalled();
		expect(getCachedGameEngineResource(queryClient)?.game.arkpack.packageId).toBe(
			"package-route",
		);
	});

	it("keeps one parent Game while moving from board into its action sibling", async () => {
		vi.useFakeTimers();
		const dispose = vi.fn();
		const game = createGame(Effect.sync(dispose));
		const { queryClient, resource, router } = createHarness("/game/package-route/board", game);
		const engine = resource.game;
		await router.load();

		const navigation = router.navigate({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: "package-route",
			},
			search: {
				destination: "main-menu",
			},
		});
		await vi.advanceTimersByTimeAsync(2_500);
		await navigation;

		expect(dispose).toHaveBeenCalledOnce();
		expect(resource.game).toBe(engine);
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
