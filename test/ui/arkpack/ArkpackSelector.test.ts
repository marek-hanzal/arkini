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
			arkpacks: [
				{
					packageId: "package:built-in",
					contentHash: "a".repeat(64),
					gameId: "arkini",
					title: "Arkini",
					configVersion: "1",
					compressedSize: 1,
					trust: {
						type: "official",
						keyId: "test-official",
					} as const,
					source: "built-in" as const,
				},
				{
					packageId: "package:local",
					contentHash: "b".repeat(64),
					gameId: "local",
					title: "Local package",
					configVersion: "1",
					compressedSize: 1,
					trust: {
						type: "external",
						reason: "unsigned",
					} as const,
					source: "imported" as const,
					filename: "local.arkpack",
				},
			],
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
		const loadRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/action/load-game/$packageId",
			component: () => createElement("p", null, "Load destination"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				arkpacksRoute,
				mainMenuRoute,
				loadRoute,
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
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]')?.style
				.viewTransitionName,
		).toBe("arkini-panel-arkpacks");
		expect(
			container.querySelector<HTMLElement>('[data-ui="MainPagePanelContent"]')?.style
				.viewTransitionName,
		).toBe("");
		const layout = container.querySelector('[data-ui="ArkpackSelector"]');
		const catalogList = container.querySelector<HTMLElement>('[data-ui="ArkpackCatalogList"]');
		expect(catalogList?.className).toContain("ak-list");
		const catalogRows = Array.from(
			catalogList?.querySelectorAll<HTMLElement>('[data-ui="ArkpackCatalogRow"]') ?? [],
		);
		expect(catalogRows).toHaveLength(2);
		expect(catalogRows[0]?.textContent).toContain("Official");
		expect(catalogRows[1]?.textContent).toContain("External");
		expect(catalogRows.every((row) => row.className.includes("ak-list-row"))).toBe(true);
		expect(catalogRows.every((row) => !row.className.includes("ak-list-row-interactive"))).toBe(
			true,
		);
		expect(layout?.lastElementChild?.tagName).toBe("FOOTER");
		expect(layout?.lastElementChild?.className).toContain("justify-center");
		const returnButton = layout?.lastElementChild?.querySelector("button");
		expect(returnButton?.textContent).toBe("Return to main menu");
		expect(returnButton?.className).toContain("bg-accent");

		await act(async () => returnButton?.click());
		expect(router.state.location.pathname).toBe("/main-menu");
	});
});
