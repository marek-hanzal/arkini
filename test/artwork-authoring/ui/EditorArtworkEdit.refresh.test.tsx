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
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementBoundary } from "~/authoring-session/ui/EditorProjectReplacementBoundary";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorShell } from "~/authoring-shell/ui/EditorShell";
import { useEditorArtworkEditController } from "~/artwork-authoring/ui/useEditorArtworkEditController";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import {
	editorTestPayload,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => useAtomValue(EditorProjectAtom("artwork-refresh-session")),
}));
vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrl: () => undefined,
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
}));
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
it("drains admitted artwork validation, commit and publication before hard Refresh", async () => {
	const project = {
		projectId: "artwork-refresh-session",
		title: editorTestPayload.config.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: editorTestPayload.config,
		resources: editorTestResources,
	};
	const fresh = {
		...project,
		title: "Externally refreshed title",
		config: {
			...project.config,
			meta: {
				...project.config.meta,
				title: "Externally refreshed title",
			},
		},
	};
	const atom = EditorProjectAtom(project.projectId);
	const releaseFn = RendererAtomRegistry.mount(atom);
	RendererAtomRegistry.set(atom, {
		replacement: project,
	});
	let finishDecodeFn!: (bitmap: ImageBitmap) => void;
	const bitmap = {
		width: 1,
		height: 1,
		close: vi.fn(),
	} as unknown as ImageBitmap;
	const decodeFn = vi
		.fn()
		.mockResolvedValueOnce(bitmap)
		.mockImplementation(
			() =>
				new Promise<ImageBitmap>((resolveFn) => {
					finishDecodeFn = resolveFn;
				}),
		);
	vi.stubGlobal("createImageBitmap", decodeFn);
	const replaceResourceFn = vi.fn(async ({ resourceUid, resource }) => ({
		type: "success",
		value: {
			...project,
			revision: 1,
			updatedAtMs: 2,
			resources: project.resources.map((r) =>
				r.uid === resourceUid
					? {
							...r,
							uid: resource.uid,
							title: resource.title,
						}
					: r,
			),
		},
	}));
	vi.stubGlobal("serakki", {
		file: {
			readPathFn: () => "/tmp/replacement.png",
		},
		editor: {
			awaitIdleFn: async () => ({
				type: "success",
				value: undefined,
			}),
			refreshProjectFn: async () => ({
				type: "success",
				value: fresh,
			}),
			readProjectFn: async () => ({
				type: "success",
				value: project,
			}),
			replaceResourceFn,
		},
		lifecycle: {
			onCloseFailedFn: () => () => undefined,
		},
	});
	vi.stubGlobal("scrollTo", vi.fn());
	let controller!: useEditorArtworkEditController.Output;
	const Probe = () => {
		controller = useEditorArtworkEditController({
			resourceUid: "item-water",
			filter: "all",
			query: "",
		});
		return createElement("div", null, "artwork form");
	};
	const rootRoute = createRootRoute();
	const editor = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: () =>
			createElement(
				EditorProjectReplacementBoundary,
				null,
				createElement(EditorShell, null, createElement(Outlet)),
			),
	});
	const edit = createRoute({
		getParentRoute: () => editor,
		path: "artwork/item-water/edit",
		component: Probe,
	});
	const overview = createRoute({
		getParentRoute: () => editor,
		path: "artwork/$resourceUid/detail/overview",
		component: () => createElement("div", null, "overview"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			editor.addChildren([
				edit,
				overview,
			]),
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/editor/artwork-refresh-session/artwork/item-water/edit",
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
				createElement(
					RegistryContext.Provider,
					{
						value: RendererAtomRegistry,
					},
					createElement(
						TranslationTestProvider,
						null,
						createElement(RouterProvider, {
							router,
						}),
					),
				),
			),
		);
		await act(async () =>
			controller.setFileFn(
				new File(
					[
						"png",
					],
					"replacement.png",
					{
						type: "image/png",
					},
				),
			),
		);
		let completed: boolean | undefined;
		await act(async () => {
			void controller.saveFn().then((value) => {
				completed = value;
			});
		});
		await vi.waitFor(() => expect(decodeFn).toHaveBeenCalledTimes(2));
		const refreshButton = host.querySelector<HTMLButtonElement>(
			"[data-ui=EditorProjectRefresh]",
		);
		expect(refreshButton).not.toBeNull();
		await act(async () => refreshButton!.click());
		expect(RendererAtomRegistry.get(EditorProjectReplacementEpochAtom(project.projectId))).toBe(
			0,
		);
		expect(replaceResourceFn).not.toHaveBeenCalled();
		await act(async () => finishDecodeFn(bitmap));
		await vi.waitFor(() =>
			expect(
				RendererAtomRegistry.get(EditorProjectReplacementEpochAtom(project.projectId)),
			).toBe(1),
		);
		expect(replaceResourceFn).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(completed).not.toBeUndefined());
		expect(controller.file).toBeUndefined();
		expect(RendererAtomRegistry.get(atom)?.config.meta.title).toBe(
			"Externally refreshed title",
		);
	} finally {
		await act(async () => root.unmount());
		releaseFn();
		host.remove();
		vi.unstubAllGlobals();
	}
});
