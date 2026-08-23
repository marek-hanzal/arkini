import { RegistryContext, scheduleTask } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";
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

export const cleanupArkpackSelectorTests = async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
};

export const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text} button.`);
	return button;
};

export const renderArkpackSelector = async ({
	catalog,
	openUserDirectory = () => Promise.resolve(),
}: {
	readonly catalog: ArkpackCatalog;
	readonly openUserDirectory?: () => Promise<void>;
}) => {
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			arkpack: {
				install: vi.fn(),
				list: vi.fn(),
				openUserDirectory,
				read: vi.fn(),
				remove: vi.fn(),
			},
		} satisfies Pick<Window["arkini"], "arkpack">,
	});
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});

	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	registry.set(ArkpackCatalogOwnerAtom, catalog);

	const rootRoute = createRootRoute();
	const selectorRoute = createRoute({
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
			selectorRoute,
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
