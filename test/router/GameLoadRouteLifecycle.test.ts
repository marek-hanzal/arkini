// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createGameFxMock = vi.hoisted(() => vi.fn());

vi.mock("~/bridge/game/createGameFx", () => ({
	createGameFx: createGameFxMock,
}));

import { routeTree } from "~/_route";
import type { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import type { Game } from "~/bridge/game/Game";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { testGameRead } from "~test/support/game/testGameRead";

const packageId = "package-route-load";
const roots: Array<ReturnType<typeof createRoot>> = [];

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

const createGame = ({
	createdPackageId = packageId,
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly createdPackageId?: string;
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId: createdPackageId,
		contentHash: "content-route-load",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		configVersion: testArkpackConfig.version,
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	read: testGameRead,
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

const renderRouter = async (router: ReturnType<typeof createHarness>["router"]) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(RouterProvider, {
				router,
			}),
		);
	});
	return container;
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	createGameFxMock.mockReset();
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				forceClose: vi.fn(),
			},
		} as unknown as ArkiniDesktopApi.Api,
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
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
	it("keeps an ordinary bootstrap failure on the local retryable load page", async () => {
		createGameFxMock.mockReturnValue(Effect.fail(new Error("bootstrap failed")));
		const { router } = createHarness(`/action/load-game/${packageId}`);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;
		const container = await renderRouter(router);

		expect(container.querySelector('[data-ui="ActionErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).toBeNull();
		expect(container.textContent).toContain("Retry");
	});

	it("bubbles a package identity violation from the load error page to the root fatal boundary", async () => {
		const discard = vi.fn();
		createGameFxMock.mockReturnValue(
			Effect.succeed(
				createGame({
					createdPackageId: "package-wrong",
					disposeWithoutSaveFx: Effect.sync(discard),
				}),
			),
		);
		const { router } = createHarness(`/action/load-game/${packageId}`);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;
		const container = await renderRouter(router);

		expect(discard).toHaveBeenCalled();
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ActionErrorPage"]')).toBeNull();
	});
});
