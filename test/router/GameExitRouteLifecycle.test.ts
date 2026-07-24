// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { createTestGameTransitionFields } from "~test/support/game/createTestGameTransitionFields";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const packageId = "package-exit";
const roots: Array<ReturnType<typeof createRoot>> = [];

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((nextResolve) => {
		resolve = nextResolve;
	});
	return {
		promise,
		resolve,
	};
};

const createStartup = (): LauncherStartup => ({
	getHeroUrl: () => "/hero.png",
	getSnapshot: () => ({
		type: "ready",
		appearanceReady: true,
		builtInPackageId: packageId,
		heroReady: true,
		splashCompleted: true,
	}),
	consumeHydration: () => false,
	startFx: Effect.void,
	retryFx: Effect.void,
	completeSplashFx: Effect.void,
	disposeFx: Effect.void,
	subscribe: () => () => undefined,
});

const createGame = (disposeFx: Game["disposeFx"]): Game => ({
	arkpack: {
		packageId,
		contentHash: "content-exit",
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
		packageId,
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = (game: Game) => {
	const queryClient = new QueryClient();
	const resource = Effect.runSync(createGameEngineResourceFx(game));
	queryClient.setQueryData(gameEngineQueryKey, resource);
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
				`/game/${packageId}/action/exit`,
			],
		}),
	});
	return {
		queryClient,
		resource,
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
		await vi.advanceTimersByTimeAsync(0);
	});
	return container;
};

const progressValue = (container: ParentNode) =>
	Number(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"));

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
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

describe("game exit action route", () => {
	it("shows pending Hero progress, finalizes once and remains on the completed frame", async () => {
		const gate = deferred();
		const dispose = vi.fn();
		const game = createGame(
			Effect.promise(async () => {
				dispose();
				await gate.promise;
			}),
		);
		const { queryClient, router } = createHarness(game);
		const loading = router.load();
		const container = await renderRouter(router);

		expect(dispose).toHaveBeenCalledOnce();
		expect(container.textContent).toContain("Saving and exiting Arkini…");
		expect(progressValue(container)).toBeLessThan(100);
		expect(container.querySelector('[data-ui="Board"]')).toBeNull();
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();

		await act(async () => {
			gate.resolve();
			await vi.advanceTimersByTimeAsync(2_500);
			await loading;
		});

		expect(dispose).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/action/exit`);
		expect(progressValue(container)).toBe(100);
		expect(container.querySelectorAll("button")).toHaveLength(0);
	});

	it("logs failed finalization but still completes without recovery UI", async () => {
		const failure = new Error("disk full");
		const { queryClient, resource, router } = createHarness(createGame(Effect.fail(failure)));
		const loading = router.load();
		const container = await renderRouter(router);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_500);
			await loading;
		});

		expect(getCachedGameEngineResource(queryClient)).toBe(resource);
		expect(progressValue(container)).toBe(100);
		expect(container.textContent).not.toContain("Retry");
		expect(container.textContent).not.toContain("Force");
		expect(console.error).toHaveBeenCalledOnce();
		expect(vi.mocked(console.error).mock.calls[0]?.[0]).toBe(
			"Arkini controlled close finalization failed; closing anyway.",
		);
		const loggedCause = vi.mocked(console.error).mock.calls[0]?.[1];
		expect(loggedCause).toBeInstanceOf(Error);
		expect((loggedCause as Error).message).toBe(failure.message);
	});

	it("uses a retained fail-stop resource for the terminal close attempt", async () => {
		let disposeAttempts = 0;
		const firstFailure = new Error("ordinary leave failed");
		const game = createGame(
			Effect.suspend(() => {
				disposeAttempts += 1;
				return disposeAttempts === 1 ? Effect.fail(firstFailure) : Effect.void;
			}),
		);
		const { queryClient, resource, router } = createHarness(game);
		router.history.replace(`/game/${packageId}/action/leave?destination=main-menu`);
		const leaving = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await leaving;
		expect(() => resource.assertUsable()).toThrow();
		expect(disposeAttempts).toBe(1);

		const exiting = router.navigate({
			to: "/game/$packageId/action/exit",
			params: {
				packageId,
			},
			replace: true,
		});
		await vi.advanceTimersByTimeAsync(2_500);
		await exiting;

		expect(disposeAttempts).toBe(2);
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/action/exit`);
	});
});
