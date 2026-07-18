// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AboutPage } from "~/page/launcher/AboutPage";

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

describe("About", () => {
	it("shares the launcher route and panel identities without a nested Hero snapshot", async () => {
		const rootRoute = createRootRoute({
			component: AboutPage,
		});
		const router = createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({
				initialEntries: [
					"/about",
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

		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPageLayout"]')?.style
				.viewTransitionName,
		).toBe("arkini-route-scene");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]')?.style
				.viewTransitionName,
		).toBe("arkini-main-page-panel");
		expect(
			container.querySelector<HTMLElement>('[data-ui="LauncherHero"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(container.querySelector('[data-ui="About"]')).not.toBeNull();
	});
});
