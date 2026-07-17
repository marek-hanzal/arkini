// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceProvider } from "~/ui/appearance/AppearanceProvider";
import { Settings } from "~/ui/settings/Settings";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
});

const createDeferred = () => {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

describe("Settings", () => {
	it("changes and persists the authoritative theme, then returns with Escape", async () => {
		const deferred = createDeferred();
		const write = vi.fn(() => deferred.promise);
		Object.defineProperty(window, "scrollTo", {
			configurable: true,
			value: vi.fn(),
		});
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				appearance: {
					write,
				},
			},
		});
		const queryClient = new QueryClient({
			defaultOptions: {
				mutations: {
					retry: false,
				},
			},
		});
		const rootRoute = createRootRoute();
		const settingsRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/settings",
			component: () =>
				createElement(
					QueryClientProvider,
					{
						client: queryClient,
					},
					createElement(
						AppearanceProvider,
						{
							initialTheme: "dark",
						},
						createElement(Settings),
					),
				),
		});
		const mainMenuRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/main-menu",
			component: () => createElement("p", null, "Main menu destination"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				settingsRoute,
				mainMenuRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/settings",
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

		const radios = Array.from(container.querySelectorAll('input[name="appearance-theme"]'));
		expect(radios).toHaveLength(3);
		const light = radios.find(
			(input) => input instanceof HTMLInputElement && input.value === "light",
		);
		if (!(light instanceof HTMLInputElement)) throw new Error("Expected Light theme radio.");
		expect(document.documentElement.dataset.theme).toBe("dark");
		await act(async () => light.click());
		expect(document.documentElement.dataset.theme).toBe("light");
		expect(write).toHaveBeenCalledOnce();
		expect(write).toHaveBeenCalledWith("light");
		expect(container.textContent).toContain("Saving theme…");
		const fieldset = container.querySelector("fieldset");
		expect(fieldset).toBeInstanceOf(HTMLFieldSetElement);
		expect((fieldset as HTMLFieldSetElement).disabled).toBe(true);

		await act(async () => deferred.resolve());
		await act(async () => {
			await vi.waitFor(() => expect(container.textContent).toContain("Theme saved."));
		});
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
				}),
			);
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
