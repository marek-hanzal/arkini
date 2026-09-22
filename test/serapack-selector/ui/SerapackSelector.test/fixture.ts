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
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { YourGames } from "~/serapack-selector/ui/YourGames";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
export const cleanupSerapackSelectorTests = async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "serakki");
};

export const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text} button.`);
	return button;
};

export const renderSerapackSelector = async ({
	catalog,
	openUserDirectory = () => Promise.resolve(),
	projects = [],
}: {
	readonly catalog: SerapackCatalog;
	readonly openUserDirectory?: () => Promise<void>;
	readonly projects?: ReadonlyArray<ProjectCandidate>;
}) => {
	Object.defineProperty(window, "serakki", {
		configurable: true,
		value: {
			serapack: {
				importFn: vi.fn(),
				installEditorBuildFn: vi.fn(),
				listFn: vi.fn(),
				openUserDirectoryFn: openUserDirectory,
				readFn: vi.fn(),
				removeFn: vi.fn(),
			},
		} satisfies Pick<Window["serakki"], "serapack">,
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
	registry.set(SerapackCatalogOwnerAtom, catalog);

	const rootRoute = createRootRoute();
	const selectorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/serapacks",
		component: () =>
			createElement(
				TranslationTestProvider,
				undefined,
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(YourGames, {
						projects,
					}),
				),
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
	const editorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/editor/items/list",
		component: () => createElement("p", null, "Editor destination"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			selectorRoute,
			mainMenuRoute,
			loadRoute,
			editorRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/serapacks",
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
