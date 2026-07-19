// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import type { Game } from "~/bridge/game/Game";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const fromPromiseFx = (run: () => Promise<void>) =>
	Effect.tryPromise({
		try: run,
		catch: (cause) => cause,
	});

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

class TestAnimation {
	readonly finished: Promise<void>;
	readonly cancel = vi.fn();
	readonly commitStyles = vi.fn();
	private resolveFinished!: () => void;

	constructor(
		readonly keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
		readonly options?: number | KeyframeAnimationOptions,
	) {
		this.finished = new Promise<void>((resolve) => {
			this.resolveFinished = resolve;
		});
	}

	finish() {
		this.resolveFinished();
	}
}

const animations: Array<TestAnimation> = [];
const roots: Array<ReturnType<typeof createRoot>> = [];
const viewTransitionStartPhases: Array<string | null> = [];

const createGame = (flushSaveFx: Game["flushSaveFx"] = Effect.void): Game => ({
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
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

beforeEach(() => {
	animations.splice(0);
	viewTransitionStartPhases.splice(0);
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({
			matches: true,
		})),
	});
	Object.defineProperty(document, "getAnimations", {
		configurable: true,
		value: vi.fn(() => []),
	});
	Object.defineProperty(document, "startViewTransition", {
		configurable: true,
		value: vi.fn((options: unknown) => {
			viewTransitionStartPhases.push(
				document.querySelector<HTMLElement>('[data-ui="GameMenu"]')?.parentElement?.dataset
					.phase ?? null,
			);
			const update =
				typeof options === "function"
					? options
					: (
							options as {
								readonly update: () => Promise<void> | void;
							}
						).update;
			const updateCallbackDone = Promise.resolve().then(() => update());
			return {
				finished: updateCallbackDone,
				ready: Promise.resolve(),
				skipTransition: vi.fn(),
				updateCallbackDone,
			};
		}),
	});
	Object.defineProperty(HTMLElement.prototype, "animate", {
		configurable: true,
		value: vi.fn(
			(
				keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
				options?: number | KeyframeAnimationOptions,
			) => {
				const animation = new TestAnimation(keyframes, options);
				animations.push(animation);
				return animation as unknown as Animation;
			},
		),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const renderMenu = async ({
	game = createGame(),
	requestClose = vi.fn(() => new Promise<void>(() => undefined)),
}: {
	readonly game?: Game;
	readonly requestClose?: () => Promise<void>;
} = {}) => {
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				requestClose,
			},
		} as unknown as ArkiniDesktopApi.Api,
	});
	const container = document.createElement("div");
	document.body.append(container);
	const queryClient = new QueryClient();
	const GamePage = () =>
		createElement(
			QueryClientProvider,
			{
				client: queryClient,
			},
			createElement(
				GameMenuProvider,
				null,
				createElement(
					"button",
					{
						type: "button",
						id: "game-surface",
					},
					"Game surface",
				),
				createElement(GameMenu, {
					game,
				}),
			),
		);
	const rootRoute = createRootRoute({
		component: Outlet,
	});
	const gameRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/game/$packageId",
		component: Outlet,
	});
	const boardRoute = createRoute({
		getParentRoute: () => gameRoute,
		path: "/board",
		component: GamePage,
	});
	const resetRoute = createRoute({
		getParentRoute: () => gameRoute,
		path: "/action/reset",
		component: () => createElement("div", null, "Reset action"),
	});
	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		component: () => createElement("div", null, "Settings"),
	});
	const mainMenuRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/main-menu",
		component: () => createElement("div", null, "Main menu"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			gameRoute.addChildren([
				boardRoute,
				resetRoute,
			]),
			settingsRoute,
			mainMenuRoute,
		]),
		defaultViewTransition: true,
		history: createMemoryHistory({
			initialEntries: [
				"/game/package:menu/board",
			],
		}),
	});
	await router.load();
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(RouterProvider, {
				router,
			}),
		);
	});
	return {
		container,
		router,
	};
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

const finishAnimations = async (...indexes: ReadonlyArray<number>) => {
	await act(async () => {
		for (const index of indexes) animations[index]?.finish();
		await Promise.resolve();
	});
};

const openMenu = async (container: ParentNode) => {
	await pressEscape();
	expect(container.querySelector('[data-phase="entering"]')).not.toBeNull();
	const start = animations.length - 2;
	await finishAnimations(start, start + 1);
	expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
};

const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text}.`);
	return button;
};

describe("GameMenu", () => {
	it("animates Escape close, traps focus and restores it only after completion", async () => {
		const { container } = await renderMenu();
		const surface = container.querySelector<HTMLButtonElement>("#game-surface");
		if (surface === null) throw new Error("Expected the game surface control.");
		surface.focus();
		await openMenu(container);
		expect(document.activeElement?.textContent).toBe("Return to game");

		const destroy = buttonByText(container, "Destroy");
		destroy.focus();
		await act(async () => {
			destroy.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Tab",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(document.activeElement?.textContent).toBe("Return to game");

		await pressEscape();
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(surface);
	});

	it("reverses rapid Escape during enter without duplicate overlays", async () => {
		const { container } = await renderMenu();
		await pressEscape();
		expect(buttonByText(container, "Destroy").disabled).toBe(true);
		expect(container.querySelectorAll('[data-ui="GameMenuBackdrop"]')).toHaveLength(1);
		await pressEscape();
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		expect(
			animations.slice(0, 2).every((animation) => animation.cancel.mock.calls.length > 0),
		).toBe(true);
		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		expect(container.querySelector('[data-ui="GameMenuBackdrop"]')).toBeNull();
	});

	it("navigates from the open menu through one native View Transition", async () => {
		const { container, router } = await renderMenu();
		await openMenu(container);
		const animationCount = animations.length;
		viewTransitionStartPhases.splice(0);

		await act(async () => buttonByText(container, "Settings").click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
		expect(viewTransitionStartPhases).toEqual([
			"open",
		]);
		expect(animations).toHaveLength(animationCount);
	});

	it("runs one explicit save while disabling overlapping menu actions", async () => {
		const gate = deferred();
		const flush = vi.fn(() => gate.promise);
		const game = createGame(fromPromiseFx(flush));
		const { container } = await renderMenu({
			game,
		});
		await openMenu(container);
		const save = buttonByText(container, "Save");

		await act(async () => {
			save.click();
			save.click();
		});
		expect(flush).toHaveBeenCalledOnce();
		await vi.waitFor(() =>
			expect(buttonByText(container, "Save and exit").disabled).toBe(true),
		);

		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await vi.waitFor(() => expect(container.textContent).toContain("Saved."));
	});

	it("keeps the menu open when the native close request fails", async () => {
		const { container, router } = await renderMenu({
			requestClose: () => Promise.reject(new Error("disk full")),
		});
		await openMenu(container);

		await act(async () => buttonByText(container, "Save and exit").click());
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Save and exit failed: disk full"),
		);
		expect(router.state.location.pathname).toBe("/game/package:menu/board");
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
	});

	it("uses the explicit reset action leaf after destructive confirmation", async () => {
		const { container, router } = await renderMenu();
		await openMenu(container);

		await act(async () => buttonByText(container, "Destroy").click());
		await act(async () => buttonByText(container, "Destroy permanently").click());
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/game/package%3Amenu/action/reset"),
		);
	});

	it("keeps one Escape listener while React re-renders the provider", async () => {
		const addEventListener = vi.spyOn(window, "addEventListener");
		await renderMenu();
		expect(addEventListener.mock.calls.filter(([event]) => event === "keydown")).toHaveLength(
			1,
		);
	});
});
