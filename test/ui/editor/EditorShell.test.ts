// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorShell } from "~/ui/editor/EditorShell";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";

const persists = vi.hoisted(() => ({
	run: vi.fn(),
}));

vi.mock("~/bridge/editor/persistEditorProjectMutation", async () => {
	const { Effect } = await import("effect");
	return {
		persistEditorProjectMutationFx: () =>
			Effect.tryPromise({
				try: () => persists.run(),
				catch: (error) => error,
			}),
	};
});

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		title: "Editor test",
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
let closeFailedListener: ((error: unknown) => void) | undefined;

beforeEach(() => {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	closeFailedListener = undefined;
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				onCloseFailed: (listener: (error: unknown) => void) => {
					closeFailedListener = listener;
					return () => {
						closeFailedListener = undefined;
					};
				},
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

const readLink = (container: HTMLElement, label: string) => {
	const link = [
		...container.querySelectorAll<HTMLAnchorElement>("a"),
	].find((candidate) => candidate.textContent === label);
	if (link === undefined) throw new Error(`Missing ${label} editor tab.`);
	return link;
};

const createRegistry = (staged = false) => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	if (staged) {
		registry.set(EditorProjectDraftAtom("editor-test"), {
			action: "stage",
			change: {
				item: {
					uid: "item:test",
					id: "item:test",
					type: "simple",
					title: "Test",
					description: "Test.",
					asset: {
						default: [
							"test",
						],
					},
					tags: [],
					categoryId: "category:test",
					scope: "any",
					maxStackSize: 1,
				},
			},
			key: "item:test",
		});
	}
	return registry;
};

const withQueryClient = (child: React.ReactNode, registry: AtomRegistry.AtomRegistry) =>
	createElement(
		RegistryContext.Provider,
		{
			value: registry,
		},
		createElement(
			QueryClientProvider,
			{
				client: new QueryClient({
					defaultOptions: {
						mutations: {
							retry: false,
						},
					},
				}),
			},
			child,
		),
	);

describe("EditorShell", () => {
	it("switches the active tab before the destination route finishes loading", async () => {
		const projectLoader = createGate();
		const rootRoute = createRootRoute();
		const editorRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor/$projectId",
			component: () => createElement(EditorShell, null, createElement(Outlet)),
		});
		const editorIndexRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "editor",
			component: () => createElement("p", null, "Editor destination"),
		});
		const projectRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "project",
			loader: () => projectLoader.promise,
			component: () => createElement("p", null, "Project destination"),
		});
		const buildRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "build",
			component: () => createElement("p", null, "Build destination"),
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
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				editorRoute.addChildren([
					editorIndexRoute,
					projectRoute,
					buildRoute,
					boardRoute,
				]),
				mainMenuRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/editor/editor-test/build",
				],
			}),
			defaultPendingMs: 60_000,
		});
		await router.load();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				withQueryClient(
					createElement(RouterProvider, {
						router,
					}),
					createRegistry(),
				),
			);
		});

		const projectLink = readLink(container, "Project");
		const buildLink = readLink(container, "Build");
		expect(buildLink.className).toContain("bg-accent");
		expect(projectLink.className).not.toContain("bg-accent");

		act(() => {
			projectLink.click();
		});

		expect(container.textContent).toContain("Build destination");
		expect(projectLink.className).toContain("bg-accent");
		expect(buildLink.className).not.toContain("bg-accent");

		await act(async () => {
			projectLoader.resolve();
			await projectLoader.promise;
		});

		act(() => {
			closeFailedListener?.(new Error("Save the current item before closing."));
		});
		expect(container.textContent).toContain("Save the current item before closing.");
	});

	it("keeps Save & exit retryable after failure and navigates once after success", async () => {
		vi.useRealTimers();
		persists.run
			.mockRejectedValueOnce(new Error("Invalid item."))
			.mockResolvedValueOnce(undefined);
		const rootRoute = createRootRoute();
		const editorRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor/$projectId",
			component: () => createElement(EditorShell, null, createElement(Outlet)),
		});
		const editorIndexRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "editor",
			component: () => createElement("p", null, "Item form"),
		});
		const mainMenuRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/main-menu",
			component: () => createElement("p", null, "Main menu"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				editorRoute.addChildren([
					editorIndexRoute,
				]),
				mainMenuRoute,
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/editor/editor-test/editor",
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
				withQueryClient(
					createElement(RouterProvider, {
						router,
					}),
					createRegistry(true),
				),
			);
		});
		const saveAndExit = () =>
			[
				...container.querySelectorAll<HTMLButtonElement>("button"),
			].find((button) => button.textContent === "Save & exit");

		act(() => {
			saveAndExit()?.click();
		});
		await vi.waitFor(() => expect(container.textContent).toContain("Invalid item."));
		expect(router.state.location.pathname).toBe("/editor/editor-test/editor");
		expect(saveAndExit()?.disabled).toBe(false);

		act(() => {
			saveAndExit()?.click();
		});
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
		expect(container.textContent).toContain("Main menu");
	});

	it("blocks raw form edits but allows staged changes and a synchronously cleared form", async () => {
		const rootRoute = createRootRoute();
		const editorRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor/$projectId",
			component: () => createElement(EditorShell, null, createElement(Outlet)),
		});
		const editorIndexRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "editor",
			component: () => createElement("p", null, "Dirty form"),
		});
		const projectRoute = createRoute({
			getParentRoute: () => editorRoute,
			path: "project",
			component: () => createElement("p", null, "Project destination"),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				editorRoute.addChildren([
					editorIndexRoute,
					projectRoute,
				]),
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/editor/editor-test/editor",
				],
			}),
		});
		await router.load();
		const registry = createRegistry(true);
		registry.set(EditorProjectFormDirtyAtom("editor-test"), {
			dirty: true,
			ownerId: "item-form",
		});
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				withQueryClient(
					createElement(RouterProvider, {
						router,
					}),
					registry,
				),
			);
		});

		await act(async () => {
			readLink(container, "Project").click();
		});
		expect(router.state.location.pathname).toBe("/editor/editor-test/editor");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Save the current form before leaving it."),
		);

		await act(async () => {
			registry.set(EditorProjectFormDirtyAtom("editor-test"), {
				dirty: false,
				ownerId: "item-form",
			});
			await router.navigate({
				to: "/editor/$projectId/project",
				params: {
					projectId: "editor-test",
				},
			});
		});
		expect(router.state.location.pathname).toBe("/editor/editor-test/project");
		expect(container.textContent).toContain("Project destination");
	});
});
