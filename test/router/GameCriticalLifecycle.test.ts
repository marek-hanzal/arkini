// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { createTestGameTransitionFields } from "~test/support/game/createTestGameTransitionFields";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const packageId = "package-critical";
const roots: Array<ReturnType<typeof createRoot>> = [];

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
	disposeFx = Effect.void,
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly disposeFx?: Game["disposeFx"];
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId,
		contentHash: "content-critical",
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

const installDesktopApi = (clear: () => Promise<void> = () => Promise.resolve()) => {
	const forceClose = vi.fn();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			save: {
				clear,
				read: () => Promise.resolve(null),
				write: () => Promise.resolve(),
			},
			lifecycle: {
				forceClose,
			},
		} as unknown as ArkiniDesktopApi.Api,
	});
	return forceClose;
};

const createHarness = ({
	initialPath,
	game,
	previousGameShutdown = Promise.resolve(),
}: {
	readonly initialPath: string;
	readonly game?: Game;
	readonly previousGameShutdown?: Promise<void>;
}) => {
	const queryClient = new QueryClient();
	const resource = game === undefined ? null : Effect.runSync(createGameEngineResourceFx(game));
	if (resource !== null) queryClient.setQueryData(gameEngineQueryKey, resource);
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			cheatAvailability: createCheatAvailability(),
			launcherStartup: createStartup(),
			previousGameShutdown,
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

const loadWithMinimum = async (router: ReturnType<typeof createHarness>["router"]) => {
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

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	installDesktopApi();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("critical Game route lifecycle", () => {
	it("ends the renderer after failed leave and never republishes the frozen Game", async () => {
		const failure = new Error("disk full");
		const { resource, router } = createHarness({
			initialPath: `/game/${packageId}/action/leave?destination=main-menu`,
			game: createGame({
				disposeFx: Effect.fail(failure),
			}),
		});

		await loadWithMinimum(router);
		expect(resource).not.toBeNull();
		expect(() => resource?.assertUsable()).toThrow(CriticalGameLifecycleError);
		const container = await renderRouter(router);
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).not.toBeNull();
		expect(container.textContent).not.toContain("Retry");

		await act(async () => {
			await router.navigate({
				to: "/game/$packageId/board",
				params: {
					packageId,
				},
			});
		});
		expect(
			router.state.matches.some((match) => match.error instanceof CriticalGameLifecycleError),
		).toBe(true);
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="Board"]')).toBeNull();
	});

	it("ends the renderer when destructive reset disposal fails", async () => {
		const { resource, router } = createHarness({
			initialPath: `/game/${packageId}/action/reset`,
			game: createGame({
				disposeWithoutSaveFx: Effect.fail(new Error("discard failed")),
			}),
		});

		await loadWithMinimum(router);
		expect(() => resource?.assertUsable()).toThrow(CriticalGameLifecycleError);
		expect(
			(await renderRouter(router)).querySelector('[data-ui="RootFatalErrorPage"]'),
		).not.toBeNull();
	});

	it("ends the renderer when reset clears the spent Game but cannot clear its exact save", async () => {
		installDesktopApi(() => Promise.reject(new Error("clear failed")));
		const discard = vi.fn();
		const { resource, router } = createHarness({
			initialPath: `/game/${packageId}/action/reset`,
			game: createGame({
				disposeWithoutSaveFx: Effect.sync(discard),
			}),
		});

		await loadWithMinimum(router);
		expect(discard).toHaveBeenCalledOnce();
		expect(() => resource?.assertUsable()).toThrow(CriticalGameLifecycleError);
		expect(
			(await renderRouter(router)).querySelector('[data-ui="RootFatalErrorPage"]'),
		).not.toBeNull();
	});

	it("routes a rejected HMR ownership handoff directly to the root fatal boundary", async () => {
		const { router } = createHarness({
			initialPath: "/main-menu",
			previousGameShutdown: Promise.reject(new Error("previous shutdown failed")),
		});

		await router.load();
		expect(router.state.matches[0]?.error).toBeInstanceOf(CriticalGameLifecycleError);
		expect(
			(await renderRouter(router)).querySelector('[data-ui="RootFatalErrorPage"]'),
		).not.toBeNull();
	});

	it("uses the trusted force-close action without exposing in-process recovery", async () => {
		const forceClose = installDesktopApi();
		const { router } = createHarness({
			initialPath: "/main-menu",
			previousGameShutdown: Promise.reject(new Error("fatal")),
		});
		await router.load();
		const container = await renderRouter(router);
		const close = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Close Arkini");

		await act(async () => close?.click());
		expect(forceClose).toHaveBeenCalledOnce();
		expect(container.querySelectorAll("button")).toHaveLength(1);
	});
});
