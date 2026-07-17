// @vitest-environment jsdom

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
import { ArkpackSelector } from "~/ui/arkpack/ArkpackSelector";

vi.mock("~/bridge/arkpack/useArkpacks", () => ({
	useArkpacks: () => ({
		state: {
			type: "ready" as const,
			arkpacks: [],
		},
		importFile: vi.fn(),
		remove: vi.fn(),
		refresh: vi.fn(),
	}),
}));

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
});

describe("ArkpackSelector", () => {
	it("keeps the shared primary return action in the bottom-center footer", async () => {
		Object.defineProperty(window, "scrollTo", {
			configurable: true,
			value: vi.fn(),
		});
		const rootRoute = createRootRoute();
		const arkpacksRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/arkpacks",
			component: ArkpackSelector,
		});
		const mainMenuRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/main-menu",
			component: () => createElement("p", null, "Main menu destination"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				arkpacksRoute,
				mainMenuRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/arkpacks",
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

		const layout = container.querySelector('[data-ui="ArkpackSelector"] > div');
		expect(layout?.lastElementChild?.tagName).toBe("FOOTER");
		expect(layout?.lastElementChild?.className).toContain("justify-center");
		const returnLink = layout?.lastElementChild?.querySelector("a");
		expect(returnLink?.textContent).toBe("Return to main menu");
		expect(returnLink?.className).toContain("bg-accent");

		await act(async () => returnLink?.click());
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
