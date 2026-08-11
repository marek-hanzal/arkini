// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect,
	RouterProvider,
	useBlocker,
} from "@tanstack/react-router";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorShell } from "~/ui/editor/EditorShell";
import {
	createEditorUnsavedChangesOwnerFx,
	EditorUnsavedChangesOwnerAtom,
} from "~/bridge/editor/EditorUnsavedChanges";
import { useEditorUnsavedChangesRegistration } from "~/ui/editor/useEditorUnsavedChangesRegistration";

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		title: "Editor test",
	}),
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

beforeEach(() => {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				onCloseFailed: () => () => undefined,
			},
		},
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

const createGate = () => {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

const BlockingDestination = () => {
	useBlocker({
		enableBeforeUnload: false,
		shouldBlockFn: () => true,
	});
	return createElement("p", null, "Build destination");
};

interface TestRouterOptions {
	readonly assetsLoader?: () => Promise<void>;
	readonly blockNavigation?: boolean;
	readonly initialEntry: string;
	readonly projectLoader?: () => Promise<void> | void;
	readonly dirtyDraft?: "invalid" | "valid";
}

const DirtyDraft = ({ valid }: { readonly valid: boolean }) => {
	useEditorUnsavedChangesRegistration("test-draft", {
		discard: () => undefined,
		isDirty: () => true,
		isValid: () => valid,
		ownsPathname: (pathname) => pathname.includes("/editor/items/test/form/"),
		save: async () => true,
	});
	return createElement("p", null, "Dirty item form");
};

const createTestRouter = ({
	assetsLoader,
	blockNavigation = false,
	dirtyDraft,
	initialEntry,
	projectLoader,
}: TestRouterOptions) => {
	const rootRoute = createRootRoute();
	const editorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: () => createElement(EditorShell, null, createElement(Outlet)),
	});
	const editorListRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "editor/items/list",
		component: () => createElement("p", null, "Editor destination"),
	});
	const itemEditRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "editor/items/test/form/identity",
		component: () =>
			dirtyDraft === undefined
				? createElement("p", null, "Item form")
				: createElement(DirtyDraft, {
						valid: dirtyDraft === "valid",
					}),
	});
	const assetsRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "assets",
		...(assetsLoader === undefined
			? {}
			: {
					loader: assetsLoader,
				}),
		component: () => createElement("p", null, "Assets destination"),
	});
	const estimateRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "estimate",
		component: () => createElement("p", null, "Estimate destination"),
	});
	const flowRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "flow",
		component: () => createElement("p", null, "Flow destination"),
	});
	const projectRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "project",
		...(projectLoader === undefined
			? {}
			: {
					loader: projectLoader,
				}),
		component: () => createElement("p", null, "Project destination"),
	});
	const buildRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "build",
		component: blockNavigation
			? BlockingDestination
			: () => createElement("p", null, "Build destination"),
	});
	const boardRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "board",
		component: () => createElement("p", null, "Board destination"),
	});
	const mainMenuRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/main-menu",
		component: () => createElement("p", null, "Main menu"),
	});
	return createRouter({
		routeTree: rootRoute.addChildren([
			editorRoute.addChildren([
				editorListRoute,
				itemEditRoute,
				estimateRoute,
				assetsRoute,
				flowRoute,
				projectRoute,
				buildRoute,
				boardRoute,
			]),
			mainMenuRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				initialEntry,
			],
		}),
		defaultPendingMs: 60_000,
	});
};

const renderRouter = async (router: ReturnType<typeof createTestRouter>) => {
	await router.load();
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registry.set(
		EditorUnsavedChangesOwnerAtom,
		Effect.runSync(createEditorUnsavedChangesOwnerFx()),
	);
	registries.push(registry);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(RouterProvider, {
					router,
				}),
			),
		);
	});
	return container;
};

const readLink = (container: HTMLElement, label: string) => {
	const link = [
		...container.querySelectorAll<HTMLAnchorElement>("a"),
	].find((candidate) => candidate.getAttribute("aria-label") === label);
	if (link === undefined) throw new Error(`Missing ${label} editor tab.`);
	return link;
};

describe("EditorShell", () => {
	it("renders an icon-only workspace rail without a global page header", async () => {
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/editor/items/list",
		});
		const container = await renderRouter(router);

		expect(readLink(container, "Items").className).toContain("bg-accent");
		expect(readLink(container, "Items").getAttribute("aria-current")).toBe("page");
		expect(
			[
				...container.querySelectorAll('[data-ui="EditorNavigation"] nav a'),
			].map((link) => link.getAttribute("aria-label")),
		).toEqual([
			"Project",
			"Items",
			"Estimate",
			"Assets",
			"Flow",
			"Build",
			"Board",
		]);
		expect(
			[
				...container.querySelectorAll('[data-ui="EditorNavigation"] nav a'),
			].every((link) => link.textContent === ""),
		).toBe(true);
		expect(container.querySelector('[data-ui="EditorNavigation"]')?.tagName).toBe("ASIDE");
		expect(container.querySelector('[data-ui="EditorShell"]')?.className).toContain(
			"grid-cols-[auto_minmax(0,1fr)]",
		);
		expect(container.textContent).not.toContain("Editor test");
		expect(container.querySelector('[data-ui="EditorExit"]')?.textContent).toBe("");
		expect(container.querySelector('[data-ui="EditorExit"]')?.className).not.toContain(
			"bg-accent",
		);
		expect(
			[
				...container.querySelectorAll("a"),
			].some((link) => link.textContent === "Editor"),
		).toBe(false);
		expect(container.querySelector('[data-ui="EditorFormStatusSlot"]')).toBeNull();
		expect(container.querySelector('[data-ui="EditorContent"]')?.className).not.toContain(
			"px-[var(--ak-viewport-padding)]",
		);
		expect(container.querySelector('[data-ui="EditorContent"]')?.className).toContain(
			"bg-surface",
		);
	});

	it("marks the all-item estimate workspace as active", async () => {
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/estimate",
		});
		const container = await renderRouter(router);

		expect(readLink(container, "Estimate").className).toContain("bg-accent");
		expect(readLink(container, "Estimate").getAttribute("aria-current")).toBe("page");
		expect(container.textContent).toContain("Estimate destination");
	});

	it("projects programmatic pending navigation before the destination finishes loading", async () => {
		const projectLoader = createGate();
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/build",
			projectLoader: () => projectLoader.promise,
		});
		const container = await renderRouter(router);
		const projectLink = readLink(container, "Project");
		const buildLink = readLink(container, "Build");

		expect(buildLink.className).toContain("bg-accent");
		expect(projectLink.className).not.toContain("bg-accent");
		let navigation!: Promise<void>;
		act(() => {
			navigation = router.navigate({
				to: "/editor/$projectId/project",
				params: {
					projectId: "editor-test",
				},
			});
		});
		expect(container.textContent).toContain("Build destination");
		expect(projectLink.className).toContain("bg-accent");
		expect(projectLink.getAttribute("aria-current")).toBe("page");
		expect(buildLink.className).not.toContain("bg-accent");
		expect(buildLink.getAttribute("aria-current")).toBeNull();

		await act(async () => {
			projectLoader.resolve();
			await navigation;
		});
	});

	it("marks an accepted link transition synchronously on click", async () => {
		const projectLoader = createGate();
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/build",
			projectLoader: () => projectLoader.promise,
		});
		const container = await renderRouter(router);
		const projectLink = readLink(container, "Project");

		act(() => {
			projectLink.click();
		});

		expect(projectLink.getAttribute("data-transitioning")).toBe("transitioning");
		expect(projectLink.className).toContain("ak-editor-workspace-tab");
		expect(projectLink.className).toContain("transition-none");
		expect(projectLink.closest("nav")?.className).toContain("ak-editor-workspace-tabs");

		await act(async () => {
			projectLoader.resolve();
			await projectLoader.promise;
		});
	});

	it("projects only the latest accepted destination during rapid navigation", async () => {
		const projectLoader = createGate();
		const assetsLoader = createGate();
		const router = createTestRouter({
			assetsLoader: () => assetsLoader.promise,
			initialEntry: "/editor/editor-test/build",
			projectLoader: () => projectLoader.promise,
		});
		const container = await renderRouter(router);
		const assetsLink = readLink(container, "Assets");
		const projectLink = readLink(container, "Project");

		let projectNavigation!: Promise<void>;
		act(() => {
			projectNavigation = router.navigate({
				to: "/editor/$projectId/project",
				params: {
					projectId: "editor-test",
				},
			});
		});
		expect(projectLink.getAttribute("aria-current")).toBe("page");

		let assetsNavigation!: Promise<void>;
		act(() => {
			assetsNavigation = router.navigate({
				to: "/editor/$projectId/assets",
				params: {
					projectId: "editor-test",
				},
			});
		});
		expect(assetsLink.getAttribute("aria-current")).toBe("page");
		expect(projectLink.getAttribute("aria-current")).toBeNull();

		await act(async () => {
			assetsLoader.resolve();
			await assetsNavigation;
			projectLoader.resolve();
			await projectNavigation;
		});
		expect(router.state.location.pathname).toBe("/editor/editor-test/assets");
		expect(assetsLink.getAttribute("aria-current")).toBe("page");
	});

	it("converges the active workspace to the final redirected destination", async () => {
		const router = createTestRouter({
			initialEntry: "/editor/editor-test/build",
			projectLoader: () => {
				throw redirect({
					href: "/editor/editor-test/assets",
				});
			},
		});
		const container = await renderRouter(router);

		await act(async () => {
			await router.navigate({
				to: "/editor/$projectId/project",
				params: {
					projectId: "editor-test",
				},
			});
		});

		expect(router.state.location.pathname).toBe("/editor/editor-test/assets");
		expect(readLink(container, "Assets").getAttribute("aria-current")).toBe("page");
		expect(readLink(container, "Project").getAttribute("aria-current")).toBeNull();
	});

	it("retains the committed workspace when navigation is blocked before acceptance", async () => {
		const projectLoader = vi.fn();
		const router = createTestRouter({
			blockNavigation: true,
			initialEntry: "/editor/editor-test/build",
			projectLoader,
		});
		const container = await renderRouter(router);

		await act(async () => {
			readLink(container, "Project").click();
			await Promise.resolve();
		});

		expect(router.state.location.pathname).toBe("/editor/editor-test/build");
		expect(projectLoader).not.toHaveBeenCalled();
		expect(readLink(container, "Build").getAttribute("aria-current")).toBe("page");
		expect(readLink(container, "Project").getAttribute("aria-current")).toBeNull();
	});

	it("keeps a dirty draft mounted when workspace navigation is canceled", async () => {
		const router = createTestRouter({
			dirtyDraft: "valid",
			initialEntry: "/editor/editor-test/editor/items/test/form/identity",
		});
		const container = await renderRouter(router);
		const projectLink = readLink(container, "Project");
		projectLink.focus();

		await act(async () => {
			projectLink.click();
			await Promise.resolve();
		});
		expect(container.querySelector('[data-ui="EditorUnsavedChangesDialog"]')).not.toBeNull();
		const cancel = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Cancel");
		expect(document.activeElement).toBe(cancel);
		await act(async () => {
			cancel?.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					key: "Escape",
				}),
			);
		});
		expect(router.state.location.pathname).toBe(
			"/editor/editor-test/editor/items/test/form/identity",
		);
		expect(container.textContent).toContain("Dirty item form");
		expect(document.activeElement).toBe(projectLink);
	});

	it("uses Cancel as the safe default for editor Exit and omits Save for an invalid draft", async () => {
		const router = createTestRouter({
			dirtyDraft: "invalid",
			initialEntry: "/editor/editor-test/editor/items/test/form/identity",
		});
		const container = await renderRouter(router);

		await act(async () => {
			container.querySelector<HTMLButtonElement>('[data-ui="EditorExit"]')?.click();
			await Promise.resolve();
		});
		const dialog = container.querySelector('[data-ui="EditorUnsavedChangesDialog"]');
		expect(dialog).not.toBeNull();
		expect(
			[
				...(dialog?.querySelectorAll("button") ?? []),
			].some((button) => button.textContent === "Save"),
		).toBe(false);
		const cancel = [
			...(dialog?.querySelectorAll("button") ?? []),
		].find((button) => button.textContent === "Cancel");
		await act(async () => cancel?.click());

		expect(router.state.location.pathname).toBe(
			"/editor/editor-test/editor/items/test/form/identity",
		);
		expect(container.querySelector<HTMLButtonElement>('[data-ui="EditorExit"]')?.disabled).toBe(
			false,
		);
	});
});
