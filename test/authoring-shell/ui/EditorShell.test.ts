// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorUnsavedChangesOwnerAtom } from "~/authoring-session/atom/EditorUnsavedChangesOwnerAtom";
import { createEditorUnsavedChangesOwnerFx } from "~/authoring-session/fx/createEditorUnsavedChangesOwnerFx";
import { EditorShell } from "~/authoring-shell/ui/EditorShell";
import { useEditorActiveWorkspace } from "~/authoring-shell/ui/useEditorActiveWorkspace";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
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
const registries: Array<AtomRegistry.AtomRegistry> = [];
beforeEach(() => {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				onCloseFailedFn: () => () => undefined,
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

const gate = () => {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

const DirtyDraft = () => {
	useEditorUnsavedChangesRegistration({
		discardFn: () => undefined,
		id: "test-draft",
		isDirtyFn: () => true,
		isValidFn: () => true,
		ownsPathnameFn: (pathname) => pathname.includes("/editor/items/test/form/"),
		saveFn: async () => true,
	});
	return createElement("p", {
		"data-ui": "DirtyDraftProbe",
	});
};

const ActiveWorkspaceProbe = () =>
	createElement(
		"output",
		{
			"data-ui": "ActiveWorkspaceProbe",
		},
		useEditorActiveWorkspace("editor-test"),
	);

const createTestRouter = ({
	assetsLoader,
	dirty = false,
	projectLoader,
}: {
	readonly assetsLoader?: () => Promise<void>;
	readonly dirty?: boolean;
	readonly projectLoader?: () => Promise<void>;
}) => {
	const rootRoute = createRootRoute();
	const editorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: () =>
			createElement(
				EditorShell,
				null,
				createElement(
					"div",
					null,
					createElement(ActiveWorkspaceProbe),
					createElement(Outlet),
				),
			),
	});
	const route = (path: "assets" | "build" | "project", loader?: () => Promise<void>) =>
		createRoute({
			getParentRoute: () => editorRoute,
			path,
			...(loader === undefined
				? {}
				: {
						loader,
					}),
			component: () => createElement("p", null, path),
		});
	const itemRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "editor/items/test/form/identity",
		component: dirty ? DirtyDraft : () => createElement("p", null, "Item form"),
	});
	return createRouter({
		routeTree: rootRoute.addChildren([
			editorRoute.addChildren([
				route("assets", assetsLoader),
				route("build"),
				route("project", projectLoader),
				itemRoute,
			]),
		]),
		history: createMemoryHistory({
			initialEntries: [
				dirty
					? "/editor/editor-test/editor/items/test/form/identity"
					: "/editor/editor-test/build",
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
	const owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
	registry.set(EditorUnsavedChangesOwnerAtom, owner);
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
	return {
		container,
		owner,
	};
};

const readLink = (container: HTMLElement, workspace: string) => {
	const link = container.querySelector<HTMLAnchorElement>(`[data-workspace-id="${workspace}"]`);
	if (link === null) throw new Error(`Missing ${workspace} editor tab.`);
	return link;
};

const readActiveWorkspace = (container: HTMLElement) =>
	container.querySelector('[data-ui="ActiveWorkspaceProbe"]')?.textContent;

describe("EditorShell", () => {
	it("projects only the latest accepted destination during rapid navigation", async () => {
		const project = gate();
		const assets = gate();
		const router = createTestRouter({
			assetsLoader: () => assets.promise,
			projectLoader: () => project.promise,
		});
		const { container } = await renderRouter(router);

		let projectNavigation!: Promise<void>;
		act(() => {
			projectNavigation = router.navigate({
				to: "/editor/$projectId/project",
				params: {
					projectId: "editor-test",
				},
			});
		});
		let assetsNavigation!: Promise<void>;
		act(() => {
			assetsNavigation = router.navigate({
				to: "/editor/$projectId/assets",
				params: {
					projectId: "editor-test",
				},
			});
		});

		expect(readActiveWorkspace(container)).toBe("assets");
		await act(async () => {
			assets.resolve();
			await assetsNavigation;
			project.resolve();
			await projectNavigation;
		});
		expect(router.state.location.pathname).toBe("/editor/editor-test/assets");
		expect(readActiveWorkspace(container)).toBe("assets");
	});

	it("keeps a dirty draft mounted when workspace navigation is canceled", async () => {
		const router = createTestRouter({
			dirty: true,
		});
		const { container, owner } = await renderRouter(router);
		await act(async () => {
			readLink(container, "project").click();
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(owner.getSnapshotFn().promptOpen).toBe(true));
		await act(async () => owner.decideFn("cancel"));

		expect(router.state.location.pathname).toBe(
			"/editor/editor-test/editor/items/test/form/identity",
		);
		expect(container.querySelector('[data-ui="DirtyDraftProbe"]')).not.toBeNull();
		expect(readLink(container, "project").getAttribute("data-ui-transitioning")).toBe("false");
	});
});
