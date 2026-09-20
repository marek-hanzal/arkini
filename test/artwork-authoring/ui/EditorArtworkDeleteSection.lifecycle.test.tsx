// @vitest-environment jsdom

import { RegistryContext, useAtomValue } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorShell } from "~/authoring-shell/ui/EditorShell";
import { EditorArtworkDeleteSection } from "~/artwork-authoring/ui/EditorArtworkDeleteSection";
import { EditorArtworkDetail } from "~/artwork-authoring/ui/EditorArtworkDetail";
import { EditorArtworkSectionHelp } from "~/artwork-authoring/ui/EditorArtworkSectionHelp";
import type { Project } from "~/project-authoring/type/Project";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import {
	editorTestPayload,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => useAtomValue(EditorProjectAtom("artwork-delete-session")),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
}));
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it.each([
	true,
	false,
])("publishes deletion and preserves navigation ownership (departed: %s)", async (departed) => {
	const project: Project = {
		projectId: "artwork-delete-session",
		title: editorTestPayload.config.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: editorTestPayload.config,
		resources: [
			...editorTestResources,
			{
				id: "unused",
				type: "artwork",
				size: 1,
				version: "1",
			},
		],
	};
	const atom = EditorProjectAtom(project.projectId);
	const releaseFn = RendererAtomRegistry.mount(atom);
	RendererAtomRegistry.set(atom, {
		replacement: project,
	});
	let finishFn!: (value: unknown) => void;
	const response = new Promise<unknown>((resolveFn) => {
		finishFn = resolveFn;
	});
	const deleteResourceFn = vi.fn(() => response);
	vi.stubGlobal("serakki", {
		editor: {
			deleteResourceFn,
		},
		lifecycle: {
			onCloseFailedFn: () => () => undefined,
		},
	});
	vi.stubGlobal("scrollTo", vi.fn());
	const rootRoute = createRootRoute();
	const editor = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: () => (
			<EditorShell>
				<Outlet />
			</EditorShell>
		),
	});
	const deletion = createRoute({
		getParentRoute: () => editor,
		path: "artwork/unused/detail/delete",
		component: () => (
			<EditorArtworkDetail
				filter="unused"
				query=""
				resourceId="unused"
				help={EditorArtworkSectionHelp.delete}
			>
				<EditorArtworkDeleteSection
					filter="unused"
					query=""
					resourceId="unused"
				/>
			</EditorArtworkDetail>
		),
	});
	const notes = createRoute({
		getParentRoute: () => editor,
		path: "notes",
		component: () => <div>Notes</div>,
	});
	const artwork = createRoute({
		getParentRoute: () => editor,
		path: "artwork",
		component: () => <div>Artwork</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			editor.addChildren([
				deletion,
				notes,
				artwork,
			]),
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/editor/artwork-delete-session/artwork/unused/detail/delete",
			],
		}),
		defaultPendingMs: 60000,
	});
	await router.load();
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	try {
		await act(async () =>
			root.render(
				<RegistryContext.Provider value={RendererAtomRegistry}>
					<TranslationTestProvider>
						<RouterProvider router={router} />
					</TranslationTestProvider>
				</RegistryContext.Provider>,
			),
		);
		await act(async () =>
			host.querySelector<HTMLButtonElement>('[data-ui="EditorArtworkDeleteOpen"]')!.click(),
		);
		await act(async () =>
			host
				.querySelector<HTMLButtonElement>('[data-ui="EditorArtworkDeleteConfirm"]')!
				.click(),
		);
		await vi.waitFor(() => expect(deleteResourceFn).toHaveBeenCalledOnce());
		expect(
			host.querySelector<HTMLButtonElement>('[data-ui="EditorArtworkDeleteConfirm"]')!
				.disabled,
		).toBe(true);
		if (departed) {
			await act(async () => {
				document.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "n",
						code: "KeyN",
						ctrlKey: true,
						shiftKey: true,
						bubbles: true,
						cancelable: true,
					}),
				);
				await Promise.resolve();
			});
			await vi.waitFor(() =>
				expect(router.state.location.pathname).toBe("/editor/artwork-delete-session/notes"),
			);
			expect(host.querySelector('[data-ui="EditorArtworkDeleteDialog"]')).toBeNull();
		}
		await act(async () => {
			finishFn({
				type: "success",
				value: {
					...project,
					revision: 1,
					updatedAtMs: 2,
					resources: editorTestResources,
				},
			});
			await response;
		});
		await vi.waitFor(() => expect(RendererAtomRegistry.get(atom)?.revision).toBe(1));
		await act(async () => {
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe(
			`/editor/artwork-delete-session/${departed ? "notes" : "artwork"}`,
		);
	} finally {
		finishFn({
			type: "failure",
			error: {
				operation: "delete-resource",
				message: "Stopped",
			},
		});
		await act(async () => root.unmount());
		releaseFn();
		host.remove();
		vi.unstubAllGlobals();
	}
});
