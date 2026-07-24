// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import type { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
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

const packageId = "package-critical";
const roots: Array<ReturnType<typeof createRoot>> = [];
const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

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
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>)),
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId,
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const installElectronApi = (clear: () => Promise<void> = () => Promise.resolve()) => {
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
		} as unknown as ArkiniElectronApi.Api,
	});
	return forceClose;
};

const createHarness = async ({
	initialPath,
	game,
}: {
	readonly initialPath: string;
	readonly game?: Game;
}) => {
	const { rendererRuntime } = createTestRendererRuntime({
		clearSaveFx: (key) =>
			Effect.tryPromise({
				try: () => window.arkini.save.clear(key),
				catch: (cause) => cause,
			}),
		createResourceFx: () =>
			game === undefined ? Effect.never : createGameEngineResourceFx(game),
	});
	runtimes.push(rendererRuntime);
	const usesFakeTimers = vi.isFakeTimers();
	if (usesFakeTimers) vi.useRealTimers();
	const resource = await (game === undefined
		? Promise.resolve(null)
		: rendererRuntime.runPromise(adoptTestGameEngineResourceFx(packageId))
	).finally(() => {
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
				initialPath,
			],
		}),
	});
	return {
		resource,
		router,
	};
};

type TestRouter = Awaited<ReturnType<typeof createHarness>>["router"];

const loadWithMinimum = async (router: TestRouter) => {
	const loading = router.load();
	await vi.advanceTimersByTimeAsync(0);
	await vi.advanceTimersByTimeAsync(2_500);
	await loading;
};

const renderRouter = async (router: TestRouter) => {
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
	installElectronApi();
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

describe("critical Game route lifecycle", () => {
	it("ends the renderer after failed leave and never republishes the frozen Game", async () => {
		const failure = new Error("disk full");
		const { resource, router } = await createHarness({
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
		const { resource, router } = await createHarness({
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
		installElectronApi(() => Promise.reject(new Error("clear failed")));
		const discard = vi.fn();
		const { resource, router } = await createHarness({
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
});
