// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import { applyCheatAvailabilityFx } from "~/bridge/cheat/applyCheatAvailabilityFx";
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

const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

const createGame = (
	disposeFx: Game["disposeFx"] = Effect.void,
	subscribeEvents: Game["subscribeEvents"] = () => () => undefined,
): Game => ({
	arkpack: {
		packageId: "package-route",
		hash: "content-route",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		game: testArkpackConfig.version,
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
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>)),
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId: "package-route",
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents,
});

const createHarness = async (
	initialPath: string,
	game: Game,
	{
		cheatsAvailable = false,
	}: {
		readonly cheatsAvailable?: boolean;
	} = {},
) => {
	const { rendererRuntime } = createTestRendererRuntime({
		createResourceFx: () => createGameEngineResourceFx(game),
	});
	runtimes.push(rendererRuntime);
	rendererRuntime.runSync(applyCheatAvailabilityFx(cheatsAvailable));
	const usesFakeTimers = vi.isFakeTimers();
	if (usesFakeTimers) vi.useRealTimers();
	const resource = await rendererRuntime
		.runPromise(adoptTestGameEngineResourceFx(game.arkpack.packageId))
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
				initialPath,
			],
		}),
	});
	return {
		rendererRuntime,
		resource,
		router,
	};
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

describe("game route lifecycle", () => {
	it("exposes the exact owned Game only through route context", async () => {
		const game = createGame();
		const { resource, router } = await createHarness("/game/package-route/board", game);

		await router.load();
		const gameMatch = router.state.matches.find(
			(match) => match.routeId === "/game/$packageId",
		);

		expect(gameMatch?.loaderData).toBeUndefined();
		expect(gameMatch?.context.gameEngine).toBe(resource.game);
		expect(gameMatch?.context.gameEngineResource).toBe(resource);
	});

	it("does not mount playable Game consumers around an action descendant", async () => {
		vi.useFakeTimers();
		let resolveDispose!: () => void;
		const disposeStarted = vi.fn();
		const disposeGate = new Promise<void>((resolve) => {
			resolveDispose = resolve;
		});
		const subscribeEvents = vi.fn(() => () => undefined);
		const game = createGame(
			Effect.promise(async () => {
				disposeStarted();
				await disposeGate;
			}),
			subscribeEvents,
		);
		const { router } = await createHarness("/game/package-route/action/exit", game);
		const loading = router.load();
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
		await vi.waitFor(() => expect(disposeStarted).toHaveBeenCalledOnce());

		expect(subscribeEvents).not.toHaveBeenCalled();

		resolveDispose();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;
		expect(subscribeEvents).not.toHaveBeenCalled();
	});

	it("gates the save-scoped Cheats route only through application availability", async () => {
		const game = createGame();
		const unavailable = await createHarness("/game/package-route/cheats", game);
		await unavailable.router.load();
		expect(unavailable.router.state.location.pathname).toBe("/game/package-route/board");

		const available = await createHarness("/game/package-route/cheats", game, {
			cheatsAvailable: true,
		});
		await available.router.load();
		expect(available.router.state.location.pathname).toBe("/game/package-route/cheats");
	});

	it("keeps the exact parent Game while Board and Inventory leaves alternate", async () => {
		const game = createGame();
		const { rendererRuntime, resource, router } = await createHarness(
			"/game/package-route/board",
			game,
		);
		const engine = resource.game;
		await router.load();

		await router.navigate({
			to: "/game/$packageId/inventory",
			params: {
				packageId: "package-route",
			},
		});

		const sceneMatch = router.state.matches.find(
			(match) => match.routeId === "/game/$packageId/_scene",
		);
		expect(sceneMatch).toBeDefined();
		expect(resource.game).toBe(engine);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBe(resource);
		expect(router.state.location.pathname).toBe("/game/package-route/inventory");
	});

	it("preserves the current Game while standalone Settings is open", async () => {
		vi.useFakeTimers();
		const dispose = vi.fn();
		const game = createGame(Effect.sync(dispose));
		const { rendererRuntime, router } = await createHarness("/settings", game);

		const loading = router.load();
		await vi.advanceTimersByTimeAsync(2_500);
		await loading;

		expect(router.state.location.pathname).toBe("/settings");
		expect(dispose).not.toHaveBeenCalled();
		expect(
			rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack.packageId,
		).toBe("package-route");
	});

	it("releases the active Game before opening the editor", async () => {
		vi.useFakeTimers();
		const dispose = vi.fn();
		const game = createGame(Effect.sync(dispose));
		const { rendererRuntime, router } = await createHarness(
			"/game/package-route/board",
			game,
		);
		await router.load();

		const navigation = router.navigate({
			to: "/editor/welcome",
		});
		await vi.advanceTimersByTimeAsync(2_500);
		await navigation;

		expect(dispose).toHaveBeenCalledOnce();
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		expect(router.state.location.pathname).toBe("/editor/welcome");
	});

	it("keeps one parent Game while moving from board into its action sibling", async () => {
		vi.useFakeTimers();
		const dispose = vi.fn();
		const game = createGame(Effect.sync(dispose));
		const { rendererRuntime, resource, router } = await createHarness(
			"/game/package-route/board",
			game,
		);
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
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
