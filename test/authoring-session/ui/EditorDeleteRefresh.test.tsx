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
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorProjectReplacementBoundary } from "~/authoring-session/ui/EditorProjectReplacementBoundary";
import { EditorShell } from "~/authoring-shell/ui/EditorShell";
import { EditorArtworkDeleteSection } from "~/artwork-authoring/ui/EditorArtworkDeleteSection";
import { EditorArtworkDetail } from "~/artwork-authoring/ui/EditorArtworkDetail";
import { EditorArtworkSectionHelp } from "~/artwork-authoring/ui/EditorArtworkSectionHelp";
import { DeleteSection } from "~/item-authoring/ui/DeleteSection";
import { Detail } from "~/item-authoring/ui/Detail";
import type { Project } from "~/project-authoring/type/Project";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import {
	editorTestPayload,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";

const projectId = "delete-refresh";
const projectAtom = EditorProjectAtom(projectId);
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => useAtomValue(projectAtom),
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
	"artwork",
	"item",
] as const)("finishes %s deletion and publication before a pending hard Refresh", async (kind) => {
	const project: Project = {
		projectId,
		title: editorTestPayload.config.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: {
			...editorTestPayload.config,
			start: {
				...editorTestPayload.config.start,
				board: [],
			},
		},
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
	const saved: Project = {
		...project,
		revision: 1,
		updatedAtMs: 2,
		config:
			kind === "item"
				? {
						...project.config,
						items: {},
					}
				: project.config,
		resources: kind === "artwork" ? editorTestResources : project.resources,
	};
	const releaseProjectFn = RendererAtomRegistry.mount(projectAtom);
	const epochAtom = EditorProjectReplacementEpochAtom(projectId);
	const releaseEpochFn = RendererAtomRegistry.mount(epochAtom);
	RendererAtomRegistry.set(projectAtom, {
		replacement: project,
	});
	RendererAtomRegistry.set(epochAtom, 0);
	let finishDeleteFn!: (value: unknown) => void;
	const response = new Promise<unknown>((resolveFn) => {
		finishDeleteFn = resolveFn;
	});
	const deleteFn = vi.fn(() => response);
	let publishedAtRefresh: Project | undefined;
	const refreshProjectFn = vi.fn(async () => {
		publishedAtRefresh = RendererAtomRegistry.get(projectAtom);
		return {
			type: "success",
			value: saved,
		};
	});
	vi.stubGlobal("arkini", {
		editor: {
			deleteResourceFn: deleteFn,
			deleteItemFn: deleteFn,
			awaitIdleFn: async () => ({
				type: "success",
				value: undefined,
			}),
			refreshProjectFn,
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
			<EditorProjectReplacementBoundary>
				<EditorShell>
					<Outlet />
				</EditorShell>
			</EditorProjectReplacementBoundary>
		),
	});
	const deletionPath =
		kind === "artwork" ? "artwork/unused/detail/delete" : "editor/items/water/detail/delete";
	const deletion = createRoute({
		getParentRoute: () => editor,
		path: deletionPath,
		component: () =>
			kind === "artwork" ? (
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
			) : (
				<Detail
					uid="water"
					sectionId="delete"
				>
					<DeleteSection item={project.config.items.water!} />
				</Detail>
			),
	});
	const list = createRoute({
		getParentRoute: () => editor,
		path: kind === "artwork" ? "artwork" : "editor/items/list",
		component: () => <div>Collection</div>,
	});
	const notes = createRoute({
		getParentRoute: () => editor,
		path: "notes",
		component: () => <div>Notes</div>,
	});
	const pathname = `/editor/${projectId}/${deletionPath}`;
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			editor.addChildren([
				deletion,
				list,
				notes,
			]),
		]),
		history: createMemoryHistory({
			initialEntries: [
				pathname,
			],
		}),
		defaultPendingMs: 60_000,
	});
	await router.load();
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const clickFn = async (marker: string) => {
		const button = host.querySelector<HTMLButtonElement>(`[data-ui="${marker}"]`);
		if (button === null) throw new Error(`Missing ${marker}.`);
		await act(async () => button.click());
	};
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
		await clickFn(kind === "artwork" ? "EditorArtworkDeleteOpen" : "EditorItemDeleteOpen");
		await clickFn(
			kind === "artwork" ? "EditorArtworkDeleteConfirm" : "EditorItemDeleteConfirm",
		);
		await vi.waitFor(() => expect(deleteFn).toHaveBeenCalledOnce());
		await clickFn("EditorProjectRefresh");
		expect(refreshProjectFn).not.toHaveBeenCalled();
		await act(async () =>
			finishDeleteFn({
				type: "success",
				value:
					kind === "artwork"
						? saved
						: {
								projectId,
								title: saved.title,
								version: saved.version,
								createdAtMs: 1,
								updatedAtMs: 2,
								previousRevision: 0,
								revision: 1,
								config: saved.config,
							},
			}),
		);
		await vi.waitFor(() => expect(refreshProjectFn).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(RendererAtomRegistry.get(epochAtom)).toBe(1));
		expect(publishedAtRefresh).toMatchObject(saved);
		expect(RendererAtomRegistry.get(projectAtom)).toEqual(saved);
		expect(router.state.location.pathname).toBe(pathname);
	} finally {
		finishDeleteFn({
			type: "failure",
			error: {
				operation: kind === "artwork" ? "delete-resource" : "delete-item",
				message: "Stopped",
			},
		});
		// Release a blocked terminal navigation too, so a regression cannot retain its write lease.
		await act(async () =>
			router.navigate({
				href: `/editor/${projectId}/notes`,
				ignoreBlocker: true,
			}),
		);
		await act(async () => root.unmount());
		releaseEpochFn();
		releaseProjectFn();
		host.remove();
		vi.unstubAllGlobals();
	}
});
