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
import { Effect, Exit } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { refreshEditorProjectFx } from "~/authoring-session/fx/refreshEditorProjectFx";
import { checkoutProjectVersionFx } from "~/project-version/fx/checkoutProjectVersionFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

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

vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", () => ({
	useEditorItemSearchOptions: () => ({
		items: {
			"item:beta": {
				id: "item:beta",
				uid: "item-beta-uid",
			},
		},
		options: [
			{
				id: "item:beta",
				label: "Beta item",
				meta: "Resource · item:beta",
				terms: [
					"item:beta",
					"Beta item",
					"Resource",
				],
			},
		],
	}),
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemSearchThumbnail: () =>
		createElement("span", {
			"data-ui": "ItemThumbnailProbe",
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
	const itemDetailRoute = createRoute({
		getParentRoute: () => editorRoute,
		path: "editor/items/$itemUid/detail/$sectionId",
		component: () => createElement("p", null, "Item detail"),
	});
	return createRouter({
		routeTree: rootRoute.addChildren([
			createRoute({
				getParentRoute: () => rootRoute,
				path: "/main-menu",
				component: () => createElement("p", null, "Main menu"),
			}),
			editorRoute.addChildren([
				route("assets", assetsLoader),
				route("build"),
				route("project", projectLoader),
				itemRoute,
				itemDetailRoute,
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
	it("opens the item Spotlight through Mod+Shift+K and navigates to the selected detail", async () => {
		const router = createTestRouter({});
		const { container } = await renderRouter(router);

		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "k",
					code: "KeyK",
					ctrlKey: true,
					shiftKey: true,
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});

		const search = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (search === null) throw new Error("Expected Editor item Spotlight search.");
		expect(container.querySelector('[data-ui="EditorItemSpotlight"]')).not.toBeNull();
		expect(document.activeElement).toBe(search);

		await act(async () => {
			search.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe(
				"/editor/editor-test/editor/items/item-beta-uid/detail/identity",
			),
		);
		expect(container.querySelector('[data-ui="EditorItemSpotlight"]')).toBeNull();
	});

	it("projects only the latest accepted destination during rapid navigation", async () => {
		const project = gate();
		const assets = gate();
		const router = createTestRouter({
			assetsLoader: () => assets.promise,
			projectLoader: () => project.promise,
		});
		const { container } = await renderRouter(router);

		let projectNavigation!: Promise<void>;
		await act(async () => {
			projectNavigation = router.navigate({
				to: "/editor/$projectId/project",
				params: {
					projectId: "editor-test",
				},
			});
		});
		let assetsNavigation!: Promise<void>;
		await act(async () => {
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

	it.each([
		"checkout",
		"refresh",
	] as const)(
		"keeps Close usable after %s rejects while exit is waiting for writes",
		async (operation) => {
			const router = createTestRouter({});
			const { container } = await renderRouter(router);
			const exitIdle = gate();
			const replacement = gate();
			const replacementStarted = gate();
			const awaitIdleFn = vi.fn(async () => ({
				type: "success" as const,
				value: undefined,
			}));
			awaitIdleFn.mockImplementationOnce(async () => {
				await exitIdle.promise;
				return {
					type: "success" as const,
					value: undefined,
				};
			});
			Object.defineProperty(window.arkini, "editor", {
				configurable: true,
				value: {
					awaitIdleFn,
				},
			});
			const close = container.querySelector<HTMLButtonElement>('[data-ui="EditorExit"]')!;
			await act(async () => close.click());
			await vi.waitFor(() => expect(awaitIdleFn).toHaveBeenCalledOnce());
			expect(close.disabled).toBe(true);
			const replacementFx =
				operation === "checkout"
					? checkoutProjectVersionFx({
							confirmDiscardCurrentChanges: true,
							isNavigationPendingFn: () => router.state.status === "pending",
							projectId: "editor-test",
							versionId: "version-one",
						})
					: refreshEditorProjectFx({
							isNavigationPendingFn: () => router.state.status === "pending",
							projectId: "editor-test",
						});
			const repository = RendererRuntime.runSync(ProjectRepository);
			const pending = RendererRuntime.runPromiseExit(
				replacementFx.pipe(
					Effect.provideService(ProjectRepository, {
						...repository,
						awaitIdleFx: Effect.sync(() => replacementStarted.resolve()).pipe(
							Effect.andThen(Effect.promise(() => replacement.promise)),
							Effect.andThen(
								Effect.fail(
									new ProjectRepositoryError({
										operation: "await-idle",
										message: "Pending replacement failed.",
									}),
								),
							),
						),
					}),
				),
			);
			try {
				await replacementStarted.promise;
				await act(async () => {
					exitIdle.resolve();
					await exitIdle.promise;
				});
				await act(async () => {
					replacement.resolve();
					expect(Exit.isFailure(await pending)).toBe(true);
				});
				expect(router.state.location.pathname).toBe("/editor/editor-test/build");
				expect(close.disabled).toBe(false);
				await act(async () => close.click());
				await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
			} finally {
				exitIdle.resolve();
				replacement.resolve();
				await pending;
			}
		},
	);

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
