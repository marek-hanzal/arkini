// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import {
	adoptTestGameEngineResourceFx,
	createTestRendererRuntime,
} from "~test/support/createTestRendererRuntime";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const packageId = "package-exit";
const roots: Array<ReturnType<typeof createRoot>> = [];
const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

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

const createGame = (disposeFx: Game["disposeFx"]): Game => ({
	arkpack: {
		packageId,
		contentHash: "content-exit",
		title: testArkpackConfig.meta.title,
		version: "1.0",
		arkini: ArkiniAppVersion,
		provenance: {
			type: "community",
		} as const,
		source: "user",
	},
	config: testArkpackConfig,
	disposeFx,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>)),
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId,
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = async (game: Game) => {
	const { rendererRuntime } = createTestRendererRuntime({
		createResourceFx: () =>
			createGameEngineResourceFx({
				session: game,
				resourceMetadata: {
					type: "package",
					packageId: game.arkpack.packageId,
				},
			}),
	});
	runtimes.push(rendererRuntime);
	const usesFakeTimers = vi.isFakeTimers();
	if (usesFakeTimers) vi.useRealTimers();
	const resource = await rendererRuntime
		.runPromise(adoptTestGameEngineResourceFx(packageId))
		.finally(() => {
			if (usesFakeTimers) vi.useFakeTimers();
		});
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			rendererRuntime,
		},
		history: createMemoryHistory({
			initialEntries: [
				`/game/${packageId}/action/exit`,
			],
		}),
	});
	return {
		rendererRuntime,
		resource,
		router,
	};
};

const renderRouter = async (router: Awaited<ReturnType<typeof createHarness>>["router"]) => {
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
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("game exit action route", () => {
	it("shows the pending close state, finalizes once and remains on the completed frame", async () => {
		const gate = deferred();
		const dispose = vi.fn();
		const game = createGame(
			Effect.promise(async () => {
				dispose();
				await gate.promise;
			}),
		);
		const { rendererRuntime, router } = await createHarness(game);
		const loading = router.load();
		const container = await renderRouter(router);

		expect(dispose).toHaveBeenCalledOnce();
		expect(container.textContent).toContain("Saving and exiting Arkini…");
		expect(container.querySelector('[data-ui="Board"]')).toBeNull();
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();

		await act(async () => {
			gate.resolve();
			await vi.advanceTimersByTimeAsync(2_500);
			await loading;
		});

		expect(dispose).toHaveBeenCalledOnce();
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/action/exit`);
		expect(container.querySelectorAll("button")).toHaveLength(0);
	});

	it("logs failed finalization but still completes without recovery UI", async () => {
		const failure = new Error("disk full");
		const { rendererRuntime, resource, router } = await createHarness(
			createGame(Effect.fail(failure)),
		);
		const loading = router.load();
		const container = await renderRouter(router);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_500);
			await loading;
		});

		expect(container.textContent).not.toContain("Retry");
		expect(container.textContent).not.toContain("Force");
		expect(console.error).toHaveBeenCalledOnce();
		expect(vi.mocked(console.error).mock.calls[0]?.[0]).toBe(
			"Arkini controlled close finalization failed; closing anyway.",
		);
		const loggedCause = vi.mocked(console.error).mock.calls[0]?.[1];
		expect(loggedCause).toBeInstanceOf(CriticalGameLifecycleError);
		expect(loggedCause).toMatchObject({
			operation: "game-leave",
			cause: failure,
		});
		const currentFailure = rendererRuntime.runSync(
			readCurrentGameEngineResourceFx().pipe(Effect.flip),
		);
		expect(currentFailure).toBe(loggedCause);
		expect(() => resource.assertUsable()).toThrow(loggedCause);
	});

	it("joins the retained fail-stop finalization for the terminal close attempt", async () => {
		let disposeAttempts = 0;
		const firstFailure = new Error("ordinary leave failed");
		const game = createGame(
			Effect.suspend(() => {
				disposeAttempts += 1;
				return disposeAttempts === 1 ? Effect.fail(firstFailure) : Effect.void;
			}),
		);
		const { rendererRuntime, resource, router } = await createHarness(game);
		router.history.replace(`/game/${packageId}/action/leave?destination=main-menu`);
		const leaving = router.load();
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(2_500);
		await leaving;
		expect(() => resource.assertUsable()).toThrow();
		expect(disposeAttempts).toBe(1);
		const firstLifecycleFailure = rendererRuntime.runSync(
			readCurrentGameEngineResourceFx().pipe(Effect.flip),
		);

		const exiting = router.navigate({
			to: "/game/$packageId/action/exit",
			params: {
				packageId,
			},
			replace: true,
		});
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(2_500);
		await exiting;

		expect(disposeAttempts).toBe(1);
		const terminalLifecycleFailure = rendererRuntime.runSync(
			readCurrentGameEngineResourceFx().pipe(Effect.flip),
		);
		expect(terminalLifecycleFailure).toBe(firstLifecycleFailure);
		expect(router.state.location.pathname).toBe(`/game/${packageId}/action/exit`);
	});
});
