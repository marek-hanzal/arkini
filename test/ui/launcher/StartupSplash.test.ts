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
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return {
		promise,
		resolve,
	};
};

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
			splashCompleted: true,
		});
	});
	const retry = vi.fn();
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
		component: StartupSplash,
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
	it("anchors the black hold to actual window visibility", async () => {
		const harness = createStartup();
		harness.publish(readyState());
		const { container, visible } = await renderSplash(harness.startup);
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();

		await act(async () => vi.advanceTimersByTime(10_000));
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();

		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(499));
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();
		await act(async () => vi.advanceTimersByTime(1));
		expect(container.querySelector('[data-ui="StartupSplash"]')).not.toBeNull();
		expect(container.textContent).toContain("Press Esc to continue");
	});

	it("uses Escape to finish the standalone startup page without hidden destination UI", async () => {
		const harness = createStartup();
		harness.publish(readyState());
		const { container, router, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));

		expect(container.querySelector('[data-ui="StartupHeroHandoff"]')).toBeNull();
		expect(container.textContent).not.toContain("Main menu route");
		await pressEscape();
		await vi.waitFor(() => expect(harness.complete).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("completes automatically after the minimum visible duration", async () => {
		const harness = createStartup();
		harness.publish(readyState());
		const { router, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(5_000));

		await vi.waitFor(() => expect(harness.complete).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
	});

	it("keeps startup failures on the same page and retries through the owner", async () => {
		const harness = createStartup();
		harness.publish({
			type: "failed",
			appearance: null,
			error: new Error("catalog failed"),
			heroReady: false,
			splashCompleted: false,
		});
		const { container, visible } = await renderSplash(harness.startup);
		await act(async () => visible.resolve(performance.now()));
		await act(async () => vi.advanceTimersByTime(500));

		expect(container.textContent).toContain("catalog failed");
		const retry = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Retry",
		);
		if (!(retry instanceof HTMLButtonElement)) throw new Error("Retry button missing.");
		await act(async () => retry.click());
		expect(harness.retry).toHaveBeenCalledOnce();
	});
});
