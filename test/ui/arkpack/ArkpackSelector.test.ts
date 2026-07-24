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
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
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

const renderSelector = async (catalog: ArkpackCatalog) => {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	const rootRoute = createRootRoute();
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
	return {
		container,
		router,
	};
};

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

	it("blocks Remove, Play, and import while an exact removal is pending", async () => {
		let finishRemove!: () => void;
		const removal = new Promise<void>((resolve) => {
			finishRemove = resolve;
		});
		const importFileFx = vi.fn<ArkpackCatalog["importFileFx"]>(() =>
			Effect.die("Unexpected import."),
		);
		const removeFx = vi.fn(() => Effect.promise(() => removal));
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
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
			importFileFx,
			removeFx,
			subscribe: () => () => undefined,
		};
		const { container, router } = await renderSelector(catalog);
		const removeButton = container.querySelector<HTMLButtonElement>("button");
		const playLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/action/load-game/package%3Alocal"]',
		);
		const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (removeButton === null || playLink === null || fileInput === null) {
			throw new Error("Missing Arkpack selector controls.");
		}

		await act(async () => {
			removeButton.click();
			await Promise.resolve();
		});

		expect(removeFx).toHaveBeenCalledTimes(1);
		expect(removeButton.disabled).toBe(true);
		expect(removeButton.className).toContain("cursor-progress");
		expect(container.textContent).toContain("Removing package…");
		expect(container.textContent).not.toContain("Validating package…");
		expect(playLink.getAttribute("aria-disabled")).toBe("true");
		expect(playLink.className).toContain("cursor-progress");
		expect(fileInput.disabled).toBe(true);
		expect(fileInput.className).toContain("disabled:file:cursor-progress");

		await act(async () => {
			removeButton.click();
			playLink.click();
			Object.defineProperty(fileInput, "files", {
				configurable: true,
				value: [
					new File(
						[
							"package",
						],
						"other.arkpack",
					),
				],
			});
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
		});
		expect(removeFx).toHaveBeenCalledTimes(1);
		expect(importFileFx).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/arkpacks");

		await act(async () => {
			finishRemove();
			await removal;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(removeButton.disabled).toBe(false);
		expect(playLink.getAttribute("aria-disabled")).toBe("false");
		expect(fileInput.disabled).toBe(false);
	});

	it("blocks catalog actions and repeated file changes while import is pending", async () => {
		let finishImport!: (arkpack: ArkpackDescriptor) => void;
		const imported: ArkpackDescriptor = {
			packageId: "package:imported",
			contentHash: "c".repeat(64),
			gameId: "imported",
			title: "Imported package",
			configVersion: "1",
			compressedSize: 1,
			trust: {
				type: "external",
				reason: "unsigned",
			},
			source: "imported",
			filename: "imported.arkpack",
		};
		const importing = new Promise<ArkpackDescriptor>((resolve) => {
			finishImport = resolve;
		});
		const importFileFx = vi.fn(() => Effect.promise(() => importing));
		const removeFx = vi.fn(() => Effect.void);
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				imported,
			],
		};
		const catalog: ArkpackCatalog = {
			getSnapshot: () => catalogState,
			refreshFx: Effect.void,
			importFileFx,
			removeFx,
			subscribe: () => () => undefined,
		};
		const { container, router } = await renderSelector(catalog);
		const removeButton = container.querySelector<HTMLButtonElement>("button");
		const playLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/action/load-game/package%3Aimported"]',
		);
		const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (removeButton === null || playLink === null || fileInput === null) {
			throw new Error("Missing Arkpack selector controls.");
		}
		const file = new File(
			[
				"package",
			],
			"imported.arkpack",
		);
		Object.defineProperty(fileInput, "files", {
			configurable: true,
			value: [
				file,
			],
		});

		await act(async () => {
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
		});
		expect(importFileFx).toHaveBeenCalledTimes(1);
		expect(removeButton.disabled).toBe(true);
		expect(container.textContent).toContain("Validating package…");
		expect(container.textContent).not.toContain("Removing package…");
		expect(playLink.getAttribute("aria-disabled")).toBe("true");
		expect(fileInput.disabled).toBe(true);

		await act(async () => {
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			removeButton.click();
			playLink.click();
			await Promise.resolve();
		});
		expect(importFileFx).toHaveBeenCalledTimes(1);
		expect(removeFx).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/arkpacks");

		await act(async () => {
			finishImport(imported);
			await importing;
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/action/load-game/package%3Aimported");
	});
});
