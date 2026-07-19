// @vitest-environment jsdom

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
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogContext } from "~/bridge/arkpack/ArkpackCatalogContext";
import { ArkpackSelectorPage } from "~/page/arkpack/ArkpackSelectorPage";

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
		const catalogState = {
			type: "ready" as const,
			arkpacks: [],
		};
		const catalog: ArkpackCatalog = {
			getSnapshot: () => catalogState,
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
			subscribe: () => () => undefined,
		};
		const arkpacksRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/arkpacks",
			component: () =>
				createElement(
					ArkpackCatalogContext.Provider,
					{
						value: catalog,
					},
					createElement(ArkpackSelectorPage),
				),
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

		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPageLayout"]')?.style
				.viewTransitionName,
		).toBe("arkini-route-scene");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]')?.style
				.viewTransitionName,
		).toBe("");
		const layout = container.querySelector('[data-ui="ArkpackSelector"]');
		expect(layout?.lastElementChild?.tagName).toBe("FOOTER");
		expect(layout?.lastElementChild?.className).toContain("justify-center");
		const returnButton = layout?.lastElementChild?.querySelector("button");
		expect(returnButton?.textContent).toBe("Return to main menu");
		expect(returnButton?.className).toContain("bg-accent");

		await act(async () => returnButton?.click());
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
