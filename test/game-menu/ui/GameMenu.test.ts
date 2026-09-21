// @vitest-environment jsdom

import { RegistryContext } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheatAvailabilityAtom } from "~/application-settings/atom/CheatAvailabilityAtom";
import type { Game } from "~/installed-game/type/Game";
import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { GameMenu } from "~/game-menu/ui/GameMenu";
import { GameMenuProvider } from "~/game-menu/ui/GameMenuProvider";
import { testSerapackConfig } from "~test/serapack-support/fx/createTestSerapack";
import { makeTestGameTransitionFieldsFx } from "~test/support/makeTestGameTransitionFieldsFx";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { testGameRead } from "~test/support/testGameRead";

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

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

const roots: Array<ReturnType<typeof createRoot>> = [];
const viewTransitionStartPhases: Array<string | null> = [];

const gameSnapshots = {
	disabled: {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
	},
	enabled: {
		cheats: {
			enabled: true,
			everEnabled: true,
			speedUpGameplay: false,
		},
	},
} as const;

const createGame = (
	flushSaveFx: Game["flushSaveFx"] = Effect.void,
	cheatEnabled = false,
): Game => ({
	serapack: {
		packageId: "package:menu",
		contentHash: "content:menu",
		title: "Menu game",
		version: "1.0",
		serakki: "1.0",
		provenance: {
			type: "community",
		} as const,
		source: "user",
	},
	config: testSerapackConfig,
	saveKey: {
		packageId: "package:menu",
	},
	manualSaveFx: flushSaveFx,
	listSavesFx: Effect.succeed([]),
	prepareRestoreFx: () => Effect.succeed(Effect.void),
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx,
	resources: [],
	getResourceUrlFn: () => "blob:test",
	...Effect.runSync(
		makeTestGameTransitionFieldsFx(
			(cheatEnabled ? gameSnapshots.enabled : gameSnapshots.disabled) as ReturnType<
				Game["getSnapshotFn"]
			>,
		),
	),
	readFn: testGameRead,
	runFx: ((_effect) => flushSaveFx) as Game["runFx"],
	runFn: (() => Promise.reject(new Error("Not used by this test."))) as Game["runFn"],
	subscribeFn: () => () => undefined,
	subscribeEventsFn: () => () => undefined,
});

beforeEach(() => {
	motionTestRuntime.reset();
	motionTestRuntime.autoComplete = false;
	viewTransitionStartPhases.splice(0);
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
	cheatsAvailable = false,
	requestClose = vi.fn(() => new Promise<void>(() => undefined)),
}: {
	readonly game?: Game;
	readonly cheatsAvailable?: boolean;
	readonly requestClose?: () => Promise<void>;
} = {}) => {
	const container = document.createElement("div");
	document.body.append(container);
	RendererAtomRegistry.set(CheatAvailabilityAtom, cheatsAvailable);
	RendererAtomRegistry.set(
		RendererLifecycleOwnerAtom,
		Effect.runSync(
			createRendererLifecycleFx({
				forceCloseFn: () => undefined,
				requestCloseFn: requestClose,
				waitUntilVisibleFn: () => Promise.resolve(performance.now()),
			}),
		),
	);
	let menuMounted = true;
	const menuMountListeners = new Set<() => void>();
	const setMenuMounted = (mounted: boolean) => {
		if (menuMounted === mounted) return;
		menuMounted = mounted;
		for (const listener of Array.from(menuMountListeners)) listener();
	};
	const GameMenuMount = () => {
		const mounted = useSyncExternalStore(
			(listener) => {
				menuMountListeners.add(listener);
				return () => menuMountListeners.delete(listener);
			},
			() => menuMounted,
			() => menuMounted,
		);
		return mounted
			? createElement(GameMenu, {
					game,
				})
			: null;
	};
	const GamePage = () =>
		createElement(
			RegistryContext.Provider,
			{
				value: RendererAtomRegistry,
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
				createElement(GameMenuMount),
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
	const cheatsRoute = createRoute({
		getParentRoute: () => gameRoute,
		path: "/cheats",
		component: () => createElement("div", null, "Cheats"),
	});
	const resetRoute = createRoute({
		getParentRoute: () => gameRoute,
		path: "/action/reset",
		component: () => createElement("div", null, "Reset action"),
	});
	const loadRoute = createRoute({
		getParentRoute: () => gameRoute,
		path: "/action/load",
		validateSearch: (search: Record<string, unknown>) => search,
		component: () => createElement("div", null, "Load action"),
	});
	const leaveRoute = createRoute({
		getParentRoute: () => gameRoute,
		path: "/action/leave",
		validateSearch: (search: Record<string, unknown>) => search,
		component: () => createElement("div", null, "Leave action"),
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
				cheatsRoute,
				resetRoute,
				leaveRoute,
				loadRoute,
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
		setMenuMounted,
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

const finishMotion = async (...indexes: ReadonlyArray<number>) => {
	await act(async () => {
		motionTestRuntime.finish(...indexes);
		await Promise.resolve();
	});
};

const openMenu = async (container: ParentNode) => {
	await pressEscape();
	expect(container.querySelector('[data-phase="entering"]')).not.toBeNull();
	const completion = motionTestRuntime.completions.length - 1;
	await finishMotion(completion);
	expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
};

const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent?.trim() === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text}.`);
	return button;
};

describe("GameMenu", () => {
	it("quick-saves with the menu closed and blocks repeated shortcuts and load until saving settles", async () => {
		const gate = deferred();
		const manual = vi.fn(() => gate.promise);
		const flush = vi.fn();
		const { container, router } = await renderMenu({
			game: {
				...createGame(),
				manualSaveFx: fromPromiseFx(manual),
				flushSaveFx: Effect.sync(flush),
			},
		});
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();
		const pressFn = (key: string, options: KeyboardEventInit = {}) => {
			const event = new KeyboardEvent("keydown", {
				key,
				bubbles: true,
				cancelable: true,
				...options,
			});
			window.dispatchEvent(event);
			return event;
		};
		await act(async () => {
			pressFn("F5", {
				repeat: true,
			});
			pressFn("F5", {
				ctrlKey: true,
			});
			pressFn("F5", {
				metaKey: true,
			});
		});
		expect(manual).not.toHaveBeenCalled();
		await act(async () => {
			expect(pressFn("F5").defaultPrevented).toBe(true);
			pressFn("F5");
			pressFn("F9");
		});
		expect(manual).toHaveBeenCalledOnce();
		expect(flush).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/game/package:menu/board");
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();
		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await vi.waitFor(() => expect(container.textContent).toContain("Saved."));
	});

	it("quick-loads the manual slot while the menu is closed", async () => {
		const { container, router } = await renderMenu({
			game: {
				...createGame(),
				listSavesFx: Effect.succeed([
					{
						slot: "manual",
						savedAt: 1_700_000_000_000,
					},
				]),
			},
		});
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "F9",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/game/package%3Amenu/action/load"),
		);
		expect(router.state.location.search).toEqual({
			slot: "manual",
		});
	});

	it("silently keeps the game running when quick-load has no manual save", async () => {
		const readSavesFn = vi.fn(() => []);
		const { container, router } = await renderMenu({
			game: {
				...createGame(),
				listSavesFx: Effect.sync(readSavesFn),
			},
		});
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "F9",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await vi.waitFor(() => expect(readSavesFn).toHaveBeenCalledOnce());
		await act(async () => {
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="GameSaveNotice"]')).toBeNull();
		expect(router.state.location.pathname).toBe("/game/package:menu/board");
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();
	});

	it("does not navigate after an in-flight save lookup outlives its menu owner", async () => {
		const gate = deferred();
		const readSavesFn = vi.fn(async () => {
			await gate.promise;
			return [
				{
					slot: "manual" as const,
					savedAt: 1_700_000_000_000,
				},
			];
		});
		const { router, setMenuMounted } = await renderMenu({
			game: {
				...createGame(),
				listSavesFx: Effect.promise(readSavesFn),
			},
		});
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "F9",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await vi.waitFor(() => expect(readSavesFn).toHaveBeenCalledOnce());
		await act(async () => setMenuMounted(false));
		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		expect(router.state.location.pathname).toBe("/game/package:menu/board");
		expect(router.state.location.search).toEqual({});
	});

	it("animates Escape close through the owned motion lifecycle", async () => {
		const { container } = await renderMenu();
		await openMenu(container);
		await pressEscape();
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		const exitCompletion = motionTestRuntime.completions.length - 1;
		await finishMotion(exitCompletion);
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();
	});

	it("reverses rapid Escape during enter without duplicate overlays", async () => {
		const { container } = await renderMenu();
		await pressEscape();
		expect(buttonByText(container, "Start over").disabled).toBe(true);
		expect(container.querySelectorAll('[data-ui="GameMenuBackdrop"]')).toHaveLength(1);
		const enteringCompletion = motionTestRuntime.completions.length - 1;
		await pressEscape();
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		await finishMotion(enteringCompletion);
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		const exitCompletion = motionTestRuntime.completions.length - 1;
		await finishMotion(exitCompletion);
		expect(container.querySelector('[data-ui="GameMenuBackdrop"]')).toBeNull();
	});

	it("navigates from the open menu through one native View Transition", async () => {
		const { container, router } = await renderMenu();
		await openMenu(container);
		viewTransitionStartPhases.splice(0);

		await act(async () => buttonByText(container, "Settings").click());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
		expect(router.state.location.search).toEqual({});
		expect(viewTransitionStartPhases).toEqual([
			"open",
		]);
	});

	it("shows the save-scoped Cheats destination only when application Cheat tools are available", async () => {
		const disabled = await renderMenu({
			game: createGame(),
		});
		await openMenu(disabled.container);
		expect(
			Array.from(disabled.container.querySelectorAll("button")).some(
				(button) => button.textContent === "Cheats",
			),
		).toBe(false);

		await act(async () => {
			for (const root of roots.splice(0)) root.unmount();
		});
		document.body.replaceChildren();
		motionTestRuntime.reset();
		motionTestRuntime.autoComplete = false;

		const enabled = await renderMenu({
			game: createGame(),
			cheatsAvailable: true,
		});
		await openMenu(enabled.container);
		await act(async () => buttonByText(enabled.container, "Cheats").click());
		await vi.waitFor(() =>
			expect(enabled.router.state.location.pathname).toBe("/game/package%3Amenu/cheats"),
		);
	});

	it("loads only an available exact slot from the floating picker", async () => {
		const game = {
			...createGame(),
			listSavesFx: Effect.succeed([
				{
					slot: "manual" as const,
					savedAt: 1_700_000_000_000,
				},
				{
					slot: "5-min" as const,
					savedAt: null,
				},
			]),
		};
		const { container, router } = await renderMenu({
			game,
		});
		await openMenu(container);
		await act(async () => buttonByText(container, "Load").click());
		await vi.waitFor(() =>
			expect(document.querySelector('[data-ui="GameSaveMenu"]')).not.toBeNull(),
		);
		const buttons = () => [
			...document.querySelectorAll<HTMLButtonElement>('[data-ui="GameSaveMenu"] button'),
		];
		await vi.waitFor(() => expect(buttons()[0]?.disabled).toBe(false));
		expect(buttons()).toHaveLength(5);
		expect(
			buttons()
				.slice(1)
				.every((button) => button.disabled),
		).toBe(true);
		await act(async () => buttons()[0]!.click());
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/game/package%3Amenu/action/load"),
		);
		expect(router.state.location.search).toEqual({
			slot: "manual",
		});
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
		const returnToGame = buttonByText(container, "Return to game");

		await act(async () => {
			save.click();
			save.click();
			returnToGame.click();
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(flush).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
		await vi.waitFor(() =>
			expect(buttonByText(container, "Save and exit").disabled).toBe(true),
		);

		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await vi.waitFor(() => expect(container.textContent).toContain("Saved."));
	});

	it("interrupts an owned save and releases its admission when the dialog is disposed", async () => {
		const interrupted = vi.fn();
		const game = createGame(
			Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
		);
		const { container, setMenuMounted } = await renderMenu({
			game,
		});
		await openMenu(container);

		await act(async () => buttonByText(container, "Save").click());
		await vi.waitFor(() => expect(buttonByText(container, "Save").disabled).toBe(true));

		await act(async () => setMenuMounted(false));
		expect(container.querySelector('[data-ui="GameMenu"]')).toBeNull();
		await vi.waitFor(() => expect(interrupted).toHaveBeenCalledOnce());
		await act(async () => setMenuMounted(true));
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
		await vi.waitFor(() => expect(buttonByText(container, "Save").disabled).toBe(false));
		expect(buttonByText(container, "Return to game").disabled).toBe(false);
	});

	it("keeps the menu open when the native close request fails", async () => {
		const { container, router } = await renderMenu({
			requestClose: () => Promise.reject(new Error("disk full")),
		});
		await openMenu(container);

		await act(async () => buttonByText(container, "Save and exit").click());
		await vi.waitFor(() =>
			expect(container.textContent).toContain(
				"Save and exit failed: Renderer lifecycle failed during request-close: disk full",
			),
		);
		expect(router.state.location.pathname).toBe("/game/package:menu/board");
	});

	it("uses the explicit reset action leaf after destructive confirmation", async () => {
		const { container, router } = await renderMenu();
		await openMenu(container);

		await act(async () => buttonByText(container, "Start over").click());
		await act(async () => buttonByText(container, "Start over").click());
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/game/package%3Amenu/action/reset"),
		);
	});

	it("keeps keyboard listeners balanced while the menu rerenders", async () => {
		const addEventListener = vi.spyOn(window, "addEventListener");
		const removeEventListener = vi.spyOn(window, "removeEventListener");
		const { container } = await renderMenu();
		const activeCountFn = () =>
			addEventListener.mock.calls.filter(([event]) => event === "keydown").length -
			removeEventListener.mock.calls.filter(([event]) => event === "keydown").length;
		const initialCount = activeCountFn();
		await openMenu(container);
		expect(activeCountFn()).toBe(initialCount);
		await pressEscape();
		await finishMotion(motionTestRuntime.completions.length - 1);
		expect(activeCountFn()).toBe(initialCount);
	});
});
