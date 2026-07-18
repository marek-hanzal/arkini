// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";
import { useGame } from "~/bridge/game/useGame";
import { GameShell } from "~/ui/shell/GameShell";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

class TestAnimation {
	readonly finished: Promise<void>;
	private resolveFinished!: () => void;

	constructor() {
		this.finished = new Promise<void>((resolve) => {
			this.resolveFinished = resolve;
		});
	}

	cancel() {}

	finish() {
		this.resolveFinished();
	}
}

const animations: Array<TestAnimation> = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

const createGame = (instanceKey: string): Game => ({
	arkpack: {
		packageId: "package:menu",
		contentHash: "content:menu",
		gameId: "game:menu",
		title: "Menu game",
		configVersion: "1.0",
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	saveKey: {
		packageId: "package:menu",
		contentHash: "b".repeat(64),
	},
	instanceKey,
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const Gameplay = () => {
	const game = useGame();
	return createElement("div", {
		"data-ui": "Gameplay",
		"data-instance": game.instanceKey,
	});
};

beforeEach(() => {
	animations.splice(0);
	Object.defineProperty(HTMLElement.prototype, "animate", {
		configurable: true,
		value: vi.fn(() => {
			const animation = new TestAnimation();
			animations.push(animation);
			return animation as unknown as Animation;
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
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const finishLatestPair = async () => {
	const start = animations.length - 2;
	await act(async () => {
		animations[start]?.finish();
		animations[start + 1]?.finish();
		await Promise.resolve();
	});
};

const pressEscape = async () => {
	await act(async () => {
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			}),
		);
	});
};

const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text}.`);
	return button;
};

describe("GameShell menu transition", () => {
	it("fades out over the fresh same-package game after hard reset", async () => {
		const original = createGame("game-instance:original");
		const fresh = createGame("game-instance:fresh");
		const listeners = new Set<() => void>();
		let state: ReturnType<GameOwner["getSnapshot"]> = {
			type: "ready",
			game: original,
		};
		const owner: GameOwner = {
			getSnapshot: () => state,
			selectPackageFx: () => Effect.void,
			releaseRouteGameFx: () => Effect.void,
			shutdownFx: () => Effect.void,
			clearFailedSaveAndRetryFx: () => Effect.void,
			hardResetFx: () =>
				Effect.sync(() => {
					state = {
						type: "ready",
						game: fresh,
					};
					for (const listener of listeners) listener();
				}),
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const App = () =>
			createElement(
				QueryClientProvider,
				{
					client: new QueryClient(),
				},
				createElement(
					GameOwnerContext.Provider,
					{
						value: owner,
					},
					createElement(
						GameShell,
						{
							packageId: "package:menu",
						},
						createElement(Gameplay),
					),
				),
			);
		const rootRoute = createRootRoute({
			component: App,
		});
		const router = createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({
				initialEntries: [
					"/game/package:menu",
				],
			}),
		});
		await router.load();
		await act(async () => {
			root.render(
				createElement(RouterProvider, {
					router,
				}),
			);
		});
		expect(container.querySelector('[data-ui="GameLoadingScreen"]')).not.toBeNull();
		await act(async () => {
			await new Promise((resolve) => window.setTimeout(resolve, 350));
		});
		expect(container.querySelector('[data-ui="Gameplay"]')?.getAttribute("data-instance")).toBe(
			"game-instance:original",
		);

		await pressEscape();
		await finishLatestPair();
		await act(async () => buttonByText(container, "Destroy").click());
		await act(async () => buttonByText(container, "Destroy permanently").click());
		await vi.waitFor(() =>
			expect(
				container.querySelector('[data-ui="Gameplay"]')?.getAttribute("data-instance"),
			).toBe("game-instance:fresh"),
		);
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		await finishLatestPair();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
	});

	it("does not mount the Escape menu before the initial loading gate completes", async () => {
		const game = createGame("game-instance:loading");
		const listeners = new Set<() => void>();
		let state: ReturnType<GameOwner["getSnapshot"]> = {
			type: "loading",
			packageId: "package:menu",
		};
		const owner: GameOwner = {
			getSnapshot: () => state,
			selectPackageFx: () => Effect.void,
			releaseRouteGameFx: () => Effect.void,
			shutdownFx: () => Effect.void,
			clearFailedSaveAndRetryFx: () => Effect.void,
			hardResetFx: () => Effect.void,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const App = () =>
			createElement(
				QueryClientProvider,
				{
					client: new QueryClient(),
				},
				createElement(
					GameOwnerContext.Provider,
					{
						value: owner,
					},
					createElement(
						GameShell,
						{
							packageId: "package:menu",
						},
						createElement(Gameplay),
					),
				),
			);
		const rootRoute = createRootRoute({
			component: App,
		});
		const router = createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({
				initialEntries: [
					"/game/package:menu",
				],
			}),
		});
		await router.load();
		await act(async () => {
			root.render(
				createElement(RouterProvider, {
					router,
				}),
			);
		});
		expect(container.querySelector('[data-ui="GameLoadingScreen"]')).not.toBeNull();
		await pressEscape();
		expect(animations).toHaveLength(0);

		await act(async () => {
			state = {
				type: "ready",
				game,
			};
			for (const listener of listeners) listener();
		});
		expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe(
			"100",
		);
		await act(async () => {
			await new Promise((resolve) => window.setTimeout(resolve, 350));
		});
		expect(container.querySelector('[data-ui="Gameplay"]')?.getAttribute("data-instance")).toBe(
			"game-instance:loading",
		);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(animations).toHaveLength(0);
	});
});
