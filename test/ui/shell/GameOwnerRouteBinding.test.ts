// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { ActionLoadingProvider } from "~/ui/loading/ActionLoadingProvider";
import { GameOwnerRouteBinding } from "~/ui/shell/GameOwnerRouteBinding";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const deferred = () => {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<void>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return {
		promise,
		reject,
		resolve,
	};
};

const readyGame = {
	arkpack: {
		packageId: "package:current",
	},
} as Game;

const createOwner = ({
	releaseAction,
	selectAction,
	state,
}: {
	readonly releaseAction: () => Promise<void>;
	readonly selectAction: () => Promise<void>;
	readonly state: GameOwner.State;
}) => {
	const releaseRuns = vi.fn(releaseAction);
	const selectRuns = vi.fn(selectAction);
	const owner: GameOwner = {
		getSnapshot: () => state,
		selectPackageFx: () =>
			Effect.tryPromise({
				try: selectRuns,
				catch: (cause) => cause,
			}),
		releaseRouteGameFx: () =>
			Effect.tryPromise({
				try: releaseRuns,
				catch: (cause) => cause,
			}),
		shutdownFx: () => Effect.void,
		clearFailedSaveAndRetryFx: () => Effect.void,
		hardResetFx: () => Effect.void,
		subscribe: () => () => undefined,
	};
	return {
		owner,
		releaseRuns,
		selectRuns,
	};
};

const renderBinding = async ({
	initialPath,
	owner,
}: {
	readonly initialPath: string;
	readonly owner: GameOwner;
}) => {
	const rootRoute = createRootRoute({
		component: () =>
			createElement(
				ActionLoadingProvider,
				{
					completedHoldMs: 0,
					minimumDurationMs: 0,
				},
				createElement(GameOwnerRouteBinding, {
					owner,
				}),
				createElement(Outlet),
			),
	});
	const gameRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/game/$packageId",
		component: () => createElement("div", null, "Game destination"),
	});
	const mainMenuRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/main-menu",
		component: () => createElement("div", null, "Main menu destination"),
	});
	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		component: () => createElement("div", null, "Settings destination"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			gameRoute,
			mainMenuRoute,
			settingsRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				initialPath,
			],
		}),
	});
	await router.load();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				StrictMode,
				null,
				createElement(RouterProvider, {
					router,
				}),
			),
		);
		await Promise.resolve();
	});
	return {
		container,
		router,
	};
};

const flushLoading = async () => {
	await act(async () => {
		await vi.runAllTimersAsync();
		await Promise.resolve();
	});
};

beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({
			matches: true,
		})),
	});
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(document, "getAnimations", {
		configurable: true,
		value: vi.fn(() => []),
	});
	Object.defineProperty(document, "startViewTransition", {
		configurable: true,
		value: vi.fn((update: () => void) => {
			update();
			return {
				finished: Promise.resolve(),
				ready: Promise.resolve(),
				skipTransition: vi.fn(),
				updateCallbackDone: Promise.resolve(),
			} as unknown as ViewTransition;
		}),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				onBeforeCloseReady: () => () => undefined,
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
	Reflect.deleteProperty(document, "startViewTransition");
});

describe("GameOwnerRouteBinding", () => {
	it("runs one deduplicated game selection behind the root loader", async () => {
		const selection = deferred();
		const { owner, releaseRuns, selectRuns } = createOwner({
			releaseAction: () => Promise.resolve(),
			selectAction: () => selection.promise,
			state: {
				type: "loading",
				packageId: null,
			},
		});
		const { container } = await renderBinding({
			initialPath: "/game/package:target",
			owner,
		});

		expect(selectRuns).toHaveBeenCalledOnce();
		expect(releaseRuns).not.toHaveBeenCalled();
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ActionLoadingScreenLabel"]')?.textContent).toBe(
			"Loading game…",
		);

		await act(async () => selection.resolve());
		await flushLoading();
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).toBeNull();
	});

	it("presents route release when an owned game returns to Main Menu", async () => {
		const release = deferred();
		const { owner, releaseRuns, selectRuns } = createOwner({
			releaseAction: () => release.promise,
			selectAction: () => Promise.resolve(),
			state: {
				type: "ready",
				game: readyGame,
			},
		});
		const { container } = await renderBinding({
			initialPath: "/main-menu",
			owner,
		});

		expect(releaseRuns).toHaveBeenCalledOnce();
		expect(selectRuns).not.toHaveBeenCalled();
		expect(container.querySelector('[data-ui="ActionLoadingScreenLabel"]')?.textContent).toBe(
			"Returning to main menu…",
		);

		await act(async () => release.resolve());
		await flushLoading();
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).toBeNull();
	});

	it("releases an owned game for Settings without the deliberate loader delay", async () => {
		const { owner, releaseRuns } = createOwner({
			releaseAction: () => Promise.resolve(),
			selectAction: () => Promise.resolve(),
			state: {
				type: "ready",
				game: readyGame,
			},
		});
		const { container } = await renderBinding({
			initialPath: "/settings",
			owner,
		});
		await act(async () => Promise.resolve());

		expect(releaseRuns).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).toBeNull();
	});
});
