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
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import type { Game } from "~/bridge/game/Game";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { createTestGameTransitionFields } from "~test/support/game/createTestGameTransitionFields";
import { testGameRead } from "~test/support/game/testGameRead";

const packageId = "package-route-load";
const roots: Array<ReturnType<typeof createRoot>> = [];
const clearSaveMock = vi.fn(() => Promise.resolve());

const createStartup = (): LauncherStartup => ({
	getSnapshot: () => ({
		type: "ready",
		appearance: {
			theme: "dark",
			accent: "rose",
		},
		builtInPackageId: packageId,
		cheatsAvailable: false,
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
	...createTestGameTransitionFields(() => ({}) as ReturnType<Game["getSnapshot"]>),
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
			cheatAvailability: createCheatAvailability(),
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

const loadRoute = async (router: ReturnType<typeof createHarness>["router"]) => {
	const loading = router.load();
	await vi.advanceTimersByTimeAsync(2_500);
	await loading;
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
const clickControl = async (container: HTMLElement, label: string) => {
	const control = [
		...container.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button"),
	].find((candidate) => candidate.textContent === label);
	if (control === undefined) throw new Error(`Missing control: ${label}`);
	await act(async () => {
		control.click();
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(2_500);
		await Promise.resolve();
	});
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	createGameFxMock.mockReset();
	clearSaveMock.mockReset();
	clearSaveMock.mockResolvedValue(undefined);
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
			save: {
				clear: clearSaveMock,
				read: vi.fn(() => Promise.resolve(null)),
				write: vi.fn(() => Promise.resolve()),
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

		await loadRoute(router);

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(getCachedGameEngineResource(queryClient)?.game.arkpack).toBe(game.arkpack);
	});

	it("repairs a direct Board entry through the same explicit load action", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { queryClient, router } = createHarness(`/game/${packageId}/board`);

		await loadRoute(router);

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(getCachedGameEngineResource(queryClient)?.game.arkpack).toBe(game.arkpack);
	});
	it("discards an ordinary failed query and exits without deleting a save", async () => {
		createGameFxMock.mockReturnValue(Effect.fail(new Error("bootstrap failed")));
		const { queryClient, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);

		expect(container.querySelector('[data-ui="ActionErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).toBeNull();
		expect(container.textContent).toContain("Exit to Main Menu");
		expect(container.textContent).not.toContain("Clean & Exit");
		expect(
			[
				...container.querySelectorAll("button, a"),
			].some((control) => control.textContent === "Retry"),
		).toBe(false);

		await clickControl(container, "Exit to Main Menu");

		expect(router.state.location.pathname).toBe("/main-menu");
		expect(queryClient.getQueryState(gameEngineQueryKey)).toBeUndefined();
		expect(clearSaveMock).not.toHaveBeenCalled();
		await act(async () => {
			router.history.back();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/main-menu");
	});

	it("cleans only the verified failed save, exits, and permits a later fresh Play", async () => {
		const saveKey = {
			packageId,
			contentHash: "a".repeat(64),
		};
		createGameFxMock.mockReturnValue(
			Effect.fail(
				new GameSaveBootstrapError({
					cause: new Error("invalid save"),
					saveKey,
				}),
			),
		);
		const { queryClient, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);

		expect(container.textContent).toContain("Saved game could not be restored");
		expect(container.textContent).toContain("Clean & Exit");
		expect(container.textContent).not.toContain("Exit to Main Menu");
		expect(
			[
				...container.querySelectorAll("button, a"),
			].some((control) => control.textContent === "Retry"),
		).toBe(false);

		const createCallsBeforeCleanup = createGameFxMock.mock.calls.length;
		await clickControl(container, "Clean & Exit");

		expect(clearSaveMock).toHaveBeenCalledOnce();
		expect(clearSaveMock).toHaveBeenCalledWith(saveKey);
		expect(queryClient.getQueryState(gameEngineQueryKey)).toBeUndefined();
		expect(router.state.location.pathname).toBe("/main-menu");
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup);
		await act(async () => {
			router.history.back();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/main-menu");

		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		await act(async () => {
			const navigation = router.navigate({
				to: "/action/load-game/$packageId",
				params: {
					packageId,
				},
			});
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});

		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(getCachedGameEngineResource(queryClient)?.game.arkpack).toBe(game.arkpack);
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup + 1);
	});

	it("keeps exact cleanup failure visible and retries cleanup rather than Game loading", async () => {
		const saveKey = {
			packageId,
			contentHash: "b".repeat(64),
		};
		createGameFxMock.mockReturnValue(
			Effect.fail(
				new GameSaveBootstrapError({
					cause: new Error("invalid save"),
					saveKey,
				}),
			),
		);
		clearSaveMock.mockRejectedValueOnce(new Error("disk refused cleanup"));
		const { queryClient, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);
		const createCallsBeforeCleanup = createGameFxMock.mock.calls.length;
		await clickControl(container, "Clean & Exit");

		expect(router.state.location.pathname).toBe("/action/recover-game-save");
		expect(container.textContent).toContain("Save recovery failed");
		expect(container.textContent).toContain("Retry cleanup");
		expect(queryClient.getQueryState(gameEngineQueryKey)?.error).toBeInstanceOf(
			GameSaveBootstrapError,
		);
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup);
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

		await loadRoute(router);
		const container = await renderRouter(router);

		expect(discard).toHaveBeenCalled();
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ActionErrorPage"]')).toBeNull();
	});
});
