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
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherStartupContext } from "~/ui/launcher/LauncherStartupContext";
import { StartupSplash } from "~/ui/launcher/StartupSplash";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const createStartup = () => {
	const listeners = new Set<() => void>();
	let state: LauncherStartup.State = {
		type: "loading",
		appearance: null,
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
	const retry = vi.fn(() =>
		publish({
			type: "ready",
			appearance: {
				theme: "dark",
				accent: "rose",
			},
			builtInPackageId: "canonical-built-in",
			splashCompleted: false,
		}),
	);
	const startup: LauncherStartup = {
		startedAtMs: 0,
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

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			matches: false,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
		}),
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
		component: () => createElement("div", null, "Main menu"),
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
	};
};

describe("StartupSplash", () => {
	it("keeps the first 500 ms pure black and skips only after readiness", async () => {
		const harness = createStartup();
		const { container, router } = await renderSplash(harness.startup);
		expect(container.querySelector('[data-ui="StartupBlackHold"]')).not.toBeNull();
		expect(container.querySelector("img")).toBeNull();

		await act(async () => vi.advanceTimersByTime(499));
		expect(container.querySelector("img")).toBeNull();
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
			}),
		);
		expect(router.state.location.pathname).toBe("/");

		await act(async () => vi.advanceTimersByTime(1));
		expect(container.querySelector('[data-ui="StartupSplash"]')).not.toBeNull();
		expect(container.textContent).toContain("Preparing Arkini");

		await act(async () =>
			harness.publish({
				type: "ready",
				appearance: {
					theme: "dark",
					accent: "rose",
				},
				builtInPackageId: "canonical-built-in",
				splashCompleted: false,
			}),
		);
		expect(container.textContent).toContain("Press Esc to continue");

		await act(async () =>
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
				}),
			),
		);
		await act(async () => vi.advanceTimersByTime(650));
		expect(harness.complete).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe("/main-menu");
	});

	it("keeps a startup failure visible and retries through the same owner", async () => {
		const harness = createStartup();
		const { container } = await renderSplash(harness.startup);
		await act(async () => vi.advanceTimersByTime(500));
		await act(async () =>
			harness.publish({
				type: "failed",
				appearance: null,
				error: new Error("catalog failed"),
				splashCompleted: false,
			}),
		);
		expect(container.textContent).toContain("catalog failed");
		const retry = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Retry",
		);
		if (!(retry instanceof HTMLButtonElement)) throw new Error("Expected retry button.");
		await act(async () => retry.click());
		expect(harness.retry).toHaveBeenCalledOnce();
		expect(container.textContent).toContain("Press Esc to continue");
	});
	it("automatically exits after readiness and the five-second minimum", async () => {
		const harness = createStartup();
		const { router } = await renderSplash(harness.startup);
		await act(async () => vi.advanceTimersByTime(500));
		await act(async () =>
			harness.publish({
				type: "ready",
				appearance: {
					theme: "dark",
					accent: "rose",
				},
				builtInPackageId: "canonical-built-in",
				splashCompleted: false,
			}),
		);

		await act(async () => vi.advanceTimersByTime(4_499));
		expect(router.state.location.pathname).toBe("/");
		await act(async () => vi.advanceTimersByTime(1));
		expect(router.state.location.pathname).toBe("/");
		await act(async () => vi.advanceTimersByTime(650));
		expect(harness.complete).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe("/main-menu");
	});

	it("preserves ordering while reduced motion removes the exit animation delay", async () => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => ({
				matches: true,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
			}),
		});
		const harness = createStartup();
		const { router } = await renderSplash(harness.startup);
		await act(async () => vi.advanceTimersByTime(500));
		await act(async () =>
			harness.publish({
				type: "ready",
				appearance: {
					theme: "dark",
					accent: "rose",
				},
				builtInPackageId: "canonical-built-in",
				splashCompleted: false,
			}),
		);
		await act(async () =>
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
				}),
			),
		);
		await act(async () => vi.advanceTimersByTime(0));
		expect(harness.complete).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
