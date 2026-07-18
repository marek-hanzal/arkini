// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
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
	instanceKey: "game-instance:menu",
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createOwner = ({
	game,
	hardResetFx = Effect.void,
}: {
	readonly game: Game;
	readonly hardResetFx?: Effect.Effect<void, unknown>;
}): GameOwner => ({
	getSnapshot: () => ({
		type: "ready",
		game,
	}),
	selectPackageFx: () => Effect.void,
	releaseRouteGameFx: () => Effect.void,
	shutdownFx: () => Effect.void,
	clearFailedSaveAndRetryFx: () => Effect.void,
	hardResetFx: () => hardResetFx,
	subscribe: () => () => undefined,
});

beforeEach(() => {
	animations.splice(0);
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
	owner = createOwner({
		game,
	}),
	initialPath = "/game/package:menu",
	requestClose = vi.fn(() => new Promise<void>(() => undefined)),
}: {
	readonly game?: Game;
	readonly owner?: GameOwner;
	readonly initialPath?: string;
	readonly requestClose?: () => Promise<void>;
} = {}) => {
	let beforeCloseReady: (() => Promise<void>) | undefined;
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				requestClose,
				onBeforeCloseReady: (listener: () => Promise<void>) => {
					beforeCloseReady = listener;
					return () => {
						if (beforeCloseReady === listener) beforeCloseReady = undefined;
					};
				},
			},
		} as unknown as ArkiniDesktopApi.Api,
	});
	const container = document.createElement("div");
	document.body.append(container);
	const queryClient = new QueryClient();
	const App = () =>
		createElement(
			QueryClientProvider,
			{
				client: queryClient,
			},
			createElement(
				GameOwnerContext.Provider,
				{
					value: owner,
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
			),
		);
	const rootRoute = createRootRoute({
		component: App,
	});
	const gameRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/game/$packageId",
	});
	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			gameRoute,
			settingsRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				initialPath,
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
		runBeforeCloseReady: () => {
			if (beforeCloseReady === undefined) {
				throw new Error("Expected before-close-ready listener.");
			}
			return beforeCloseReady();
		},
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
	it("animates Escape close, keeps focus trapped and restores only after completion", async () => {
		const { container } = await renderMenu();
		const surface = container.querySelector<HTMLButtonElement>("#game-surface");
		if (surface === null) throw new Error("Expected the game surface control.");
		surface.focus();
		await openMenu(container);
		expect(animations[0]?.commitStyles).toHaveBeenCalledOnce();
		expect(animations[1]?.commitStyles).toHaveBeenCalledOnce();
		expect(animations[0]?.cancel).toHaveBeenCalledOnce();
		expect(animations[1]?.cancel).toHaveBeenCalledOnce();
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
		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
		expect(document.activeElement).not.toBe(surface);
		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		expect(animations[exitStart]?.commitStyles).toHaveBeenCalledOnce();
		expect(animations[exitStart + 1]?.commitStyles).toHaveBeenCalledOnce();
		expect(animations[exitStart]?.cancel).toHaveBeenCalledOnce();
		expect(animations[exitStart + 1]?.cancel).toHaveBeenCalledOnce();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(surface);
	});

	it("reverses rapid Escape during enter without duplicate overlays", async () => {
		const { container } = await renderMenu();
		await pressEscape();
		const backdrop = container.querySelector<HTMLElement>('[data-ui="GameMenuBackdrop"]');
		const dialog = container.querySelector<HTMLElement>('[data-ui="GameMenu"]');
		expect(container.querySelectorAll('[data-ui="GameMenuBackdrop"]')).toHaveLength(1);
		expect(backdrop?.style.opacity).toBe("0");
		expect(dialog?.style.opacity).toBe("0");
		await pressEscape();
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		expect(
			animations.slice(0, 2).every((animation) => animation.cancel.mock.calls.length > 0),
		).toBe(true);
		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		expect(container.querySelector('[data-ui="GameMenuBackdrop"]')).toBeNull();
	});

	it("finishes the menu exit before navigating to Settings", async () => {
		const { container, router } = await renderMenu();
		await openMenu(container);

		await act(async () => buttonByText(container, "Settings").click());
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		expect(router.state.location.pathname).toBe("/game/package:menu");

		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
	});

	it("runs one save while disabling overlapping menu actions", async () => {
		const gate = deferred();
		const flush = vi.fn(() => gate.promise);
		const game = createGame(fromPromiseFx(flush));
		const { container } = await renderMenu({
			game,
			owner: createOwner({
				game,
			}),
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
			await vi.waitFor(() => expect(container.textContent).toContain("Saved."));
		});
	});

	it("waits for successful shutdown before fading and close readiness", async () => {
		const requestGate = deferred();
		const requestClose = vi.fn(() => requestGate.promise);
		const game = createGame();
		const { container, router, runBeforeCloseReady } = await renderMenu({
			game,
			owner: createOwner({
				game,
			}),
			requestClose,
		});
		await openMenu(container);

		await act(async () => buttonByText(container, "Save and exit").click());
		expect(requestClose).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
		expect(router.state.location.pathname).toBe("/game/package:menu");

		let presentationCompleted = false;
		let presentation!: Promise<void>;
		await act(async () => {
			presentation = runBeforeCloseReady().then(() => {
				presentationCompleted = true;
			});
			await Promise.resolve();
		});
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		expect(presentationCompleted).toBe(false);
		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		await presentation;
		expect(presentationCompleted).toBe(true);
		expect(container.querySelector('[role="dialog"]')).toBeNull();

		await act(async () => requestGate.resolve());
	});

	it("keeps the menu fully open after native save-and-exit fails", async () => {
		const game = createGame();
		const { container, router } = await renderMenu({
			game,
			owner: createOwner({
				game,
			}),
			requestClose: () => Promise.reject(new Error("disk full")),
		});
		await openMenu(container);

		await act(async () => buttonByText(container, "Save and exit").click());
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Save and exit failed: disk full"),
		);
		expect(router.state.location.pathname).toBe("/game/package:menu");
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
	});

	it("animates confirmed hard reset only after the canonical operation succeeds", async () => {
		const reset = vi.fn();
		const game = createGame();
		const { container } = await renderMenu({
			game,
			owner: createOwner({
				game,
				hardResetFx: Effect.sync(reset),
			}),
		});
		await openMenu(container);

		await act(async () => buttonByText(container, "Destroy").click());
		expect(reset).not.toHaveBeenCalled();
		await act(async () => buttonByText(container, "Destroy permanently").click());
		await vi.waitFor(() => expect(reset).toHaveBeenCalledOnce());
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		const exitStart = animations.length - 2;
		await finishAnimations(exitStart, exitStart + 1);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
	});

	it("keeps one Escape listener while React re-renders the provider", async () => {
		const addEventListener = vi.spyOn(window, "addEventListener");
		await renderMenu();
		expect(addEventListener.mock.calls.filter(([event]) => event === "keydown")).toHaveLength(
			1,
		);
	});
});
