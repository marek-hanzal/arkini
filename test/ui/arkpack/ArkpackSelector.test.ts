// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { ArkpackSelectorPage } from "~/page/arkpack/ArkpackSelectorPage";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const renderSelector = async (catalog: ArkpackCatalog) => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	registry.set(ArkpackCatalogOwnerAtom, catalog);
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
				RegistryContext.Provider,
				{
					value: registry,
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
					hash: "a".repeat(64),
					gameId: "arkini",
					title: "Arkini",
					game: "1",
					trust: {
						type: "official",
						keyId: "test-official",
					} as const,
					source: "built-in" as const,
				},
				{
					packageId: "package:local",
					hash: "b".repeat(64),
					gameId: "local",
					title: "Local package",
					game: "1",
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
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("unused"),
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("unused"),
		};
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		const arkpacksRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/arkpacks",
			component: () =>
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
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
					hash: "b".repeat(64),
					gameId: "local",
					title: "Local package",
					game: "1",
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
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx,
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
			hash: "c".repeat(64),
			gameId: "imported",
			title: "Imported package",
			game: "1",
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
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx,
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

	it("releases removal ownership after a rejected mutation so the action can retry", async () => {
		const removeFx = vi
			.fn<ArkpackCatalog["removeFx"]>()
			.mockReturnValueOnce(Effect.fail(new Error("removal rejected")))
			.mockReturnValue(Effect.void);
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				{
					packageId: "package:local",
					hash: "b".repeat(64),
					gameId: "local",
					title: "Local package",
					game: "1",
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
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx: () => Effect.die("Unexpected import."),
			installFx: () => Effect.die("unused"),
			removeFx,
		};
		const { container } = await renderSelector(catalog);
		const removeButton = container.querySelector<HTMLButtonElement>("button");
		if (removeButton === null) throw new Error("Missing Remove action.");

		await act(async () => {
			removeButton.click();
			removeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(removeFx).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(container.textContent).toContain("removal rejected"));
		expect(removeButton.disabled).toBe(false);

		await act(async () => {
			removeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(removeFx).toHaveBeenCalledTimes(2);
		expect(removeButton.disabled).toBe(false);
	});

	it("deduplicates import and releases it after rejected destination navigation", async () => {
		const imported: ArkpackDescriptor = {
			packageId: "package:imported",
			hash: "c".repeat(64),
			gameId: "imported",
			title: "Imported package",
			game: "1",
			trust: {
				type: "external",
				reason: "unsigned",
			},
			source: "imported",
			filename: "imported.arkpack",
		};
		const importFileFx = vi.fn(() => Effect.succeed(imported));
		const catalogState = {
			type: "ready" as const,
			arkpacks: [
				imported,
			],
		};
		const catalog: ArkpackCatalog = {
			awaitIdleFx: Effect.void,
			state: Effect.runSync(SubscriptionRef.make<ArkpackCatalog.State>(catalogState)),
			refreshFx: Effect.void,
			importFileFx,
			installFx: () => Effect.die("unused"),
			removeFx: () => Effect.die("Unexpected removal."),
		};
		const { container, router } = await renderSelector(catalog);
		const navigate = vi
			.spyOn(router, "navigate")
			.mockRejectedValueOnce(new Error("load navigation rejected"));
		const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (fileInput === null) throw new Error("Missing Arkpack file input.");
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
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(importFileFx).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(container.textContent).toContain("load navigation rejected"));
		expect(fileInput.disabled).toBe(false);
		expect(router.state.location.pathname).toBe("/arkpacks");

		await act(async () => {
			fileInput.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});
		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/action/load-game/package%3Aimported"),
		);
		expect(importFileFx).toHaveBeenCalledTimes(2);
		expect(navigate).toHaveBeenCalledTimes(2);
	});
});
