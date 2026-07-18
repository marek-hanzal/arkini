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
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherStartupContext } from "~/ui/launcher/LauncherStartupContext";
import { StartupSplash } from "~/ui/launcher/StartupSplash";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((nextResolve, nextReject) => {
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

const createStartup = () => {
	const listeners = new Set<() => void>();
	let state: LauncherStartup.State = {
		type: "loading",
		appearance: null,
		heroReady: false,
		splashCompleted: false,
	};
	const publish = (next: LauncherStartup.State) => {
		state = next;
		for (const listener of listeners) listener();
	};
	const complete = vi.fn(() => {
		publish({
			...state,
			heroReady: true,
			splashCompleted: true,
		});
	});
	const retry = vi.fn(() =>
		publish({
			type: "ready",
			appearance: {
				theme: "dark",
				accent: "rose",
			},
			builtInPackageId: "canonical-built-in",
			heroReady: true,
			splashCompleted: false,
		}),
	);
	const startup: LauncherStartup = {
		getSnapshot: () => state,
		startFx: Effect.void,
		retryFx: Effect.sync(retry),
		completeSplashFx: Effect.sync(complete),
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	return {
		complete,
		publish,
		retry,
		startup,
	};
};

const readyState = (): LauncherStartup.State => ({
	type: "ready",
	appearance: {
		theme: "dark",
		accent: "rose",
	},
	builtInPackageId: "canonical-built-in",
	heroReady: true,
	splashCompleted: false,
});

beforeEach(() => {
	vi.useFakeTimers();
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
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const renderSplash = async (startup: LauncherStartup) => {
	const visible = deferred<number>();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				waitUntilVisible: () => visible.promise,
			},
		} as unknown as ArkiniDesktopApi.Api,
	});
	const Root = () =>
		createElement(
			LauncherStartupContext.Provider,
			{
				value: startup,
			},
			createElement(Outlet),
		);
	const rootRoute = createRootRoute({
		component: Root,
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () =>
			createElement(
				"div",
				null,
				createElement("div", {
					"data-ui": "MountedMainMenu",
				}),
				createElement(StartupSplash),
			),
	});
	const mainMenuRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/main-menu",
		component: () => createElement("div", null, "Main menu route"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			indexRoute,
			mainMenuRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/",
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
			createElement(RouterProvider, {
				router,
			}),
		);
	});
	return {
		container,
		router,
		visible,
	};
};

const finishAnimation = async (index: number) => {
	await act(async () => {
		animations[index]?.finish();
		await Promise.resolve();
	});
};

const pressEscape = async () => {
	await act(async () => {
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
				cancelable: true,
			}),
		);
	});
};

describe("StartupSplash", () => {
	it("anchors the black hold to actual window visibility and waits for readiness", async () => {
		const harness = createStartup();
		harness.publish(readyState());
		const { container, visible } = await renderSplash(harness.startup);
		expect(container.querySelector('[data-ui="MountedMainMenu"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();

		await act(async () => vi.advanceTimersByTime(10_000));
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();

		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(499));
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();
		await act(async () => vi.advanceTimersByTime(1));
		const splash = container.querySelector<HTMLElement>('[data-phase="entering"]');
		expect(splash).not.toBeNull();
		expect(splash?.style.opacity).toBe("0");
		expect(container.querySelector('[data-ui="StartupEnterUnderlay"]')).not.toBeNull();
		expect(animations).toHaveLength(1);
		expect(animations[0]?.options).toMatchObject({
			duration: 2_500,
		});
	});

	it("reveals the decoded Hero while the remaining bootstrap is still loading", async () => {
		const harness = createStartup();
		const { container, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();
		expect(container.querySelector("img")).toBeNull();

		await act(async () =>
			harness.publish({
				type: "loading",
				appearance: {
					theme: "dark",
					accent: "rose",
				},
				heroReady: true,
				splashCompleted: false,
			}),
		);
		expect(container.querySelector('[data-phase="entering"]')).not.toBeNull();
		expect(container.querySelector("img")).not.toBeNull();
		expect(container.textContent).toContain("Preparing Arkini");
	});

	it("queues Escape during enter and exits from the same mounted scene", async () => {
		const harness = createStartup();
		harness.publish(readyState());
		const { container, router, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));
		expect(container.querySelector('[data-phase="entering"]')).not.toBeNull();

		await pressEscape();
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		expect(animations).toHaveLength(2);
		expect(animations[0]?.cancel).toHaveBeenCalledOnce();
		expect(animations[1]?.options).toMatchObject({
			duration: 2_500,
		});
		expect(router.state.location.pathname).toBe("/");

		await finishAnimation(1);
		expect(animations[1]?.commitStyles).toHaveBeenCalledOnce();
		expect(animations[1]?.cancel).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(harness.complete).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("automatically exits after five visible seconds and actual animation completion", async () => {
		const harness = createStartup();
		harness.publish(readyState());
		const { container, router, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));
		await finishAnimation(0);
		expect(animations[0]?.commitStyles).toHaveBeenCalledOnce();
		expect(animations[0]?.cancel).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();

		await act(async () => vi.advanceTimersByTime(4_499));
		expect(container.querySelector('[data-phase="open"]')).not.toBeNull();
		await act(async () => vi.advanceTimersByTime(1));
		expect(container.querySelector('[data-phase="exiting"]')).not.toBeNull();
		expect(router.state.location.pathname).toBe("/");

		await finishAnimation(1);
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("shows failure after the visible hold and retries through the same owner", async () => {
		const harness = createStartup();
		const { container, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));
		await act(async () =>
			harness.publish({
				type: "failed",
				appearance: null,
				error: new Error("catalog failed"),
				heroReady: true,
				splashCompleted: false,
			}),
		);
		expect(container.textContent).toContain("catalog failed");
		expect(container.querySelector("img")).toBeNull();
		const retry = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Retry",
		);
		if (!(retry instanceof HTMLButtonElement)) throw new Error("Expected Retry.");
		await act(async () => retry.click());
		expect(harness.retry).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-phase="entering"]')).not.toBeNull();
	});
});
