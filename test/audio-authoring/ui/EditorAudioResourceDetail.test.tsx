// @vitest-environment jsdom
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
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
import { EditorAudioResourceDetail } from "~/audio-authoring/ui/EditorAudioResourceDetail";
import type { Project } from "~/project-authoring/type/Project";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const state = vi.hoisted(() => ({
	projectId: "",
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => useAtomValue(EditorProjectAtom(state.projectId)),
}));
vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrls: () => new Map(),
}));
vi.mock("~/project-note/ui/useProjectNotes", () => ({
	useProjectNotes: () => ({
		loaded: true,
		notes: [],
	}),
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
	"music",
	"sfx",
] as const)(
	"keeps %s metadata drafts and late saves bound to their resource across guarded navigation",
	async (type) => {
		state.projectId = `audio-${type}`;
		let project: Project = {
			projectId: state.projectId,
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
				...(type === "music"
					? {
							music: {
								playlist: [
									"second",
								],
							},
						}
					: {
							sfx: {
								events: {
									"job:started": "second",
								},
							},
						}),
			},
			resources: [
				{
					id: "first",
					type,
					name: "First recording",
					size: 10,
					version: "bytes-first",
				},
				{
					id: "second",
					type,
					name: "Second recording",
					size: 20,
					version: "bytes-second",
				},
			],
		};
		const originalConfig = project.config;
		const atom = EditorProjectAtom(state.projectId);
		const releaseFn = RendererAtomRegistry.mount(atom);
		RendererAtomRegistry.set(atom, {
			replacement: project,
		});
		let completeFirstFn!: () => void;
		const firstReply = new Promise<void>((resolveFn) => {
			completeFirstFn = resolveFn;
		});
		const saveResourceMetadataFn = vi.fn(
			async (request: { resourceId: string; name: string }) => {
				if (request.resourceId === "first") await firstReply;
				project = {
					...project,
					revision: project.revision + 1,
					resources: project.resources.map((resource) =>
						resource.id === request.resourceId
							? {
									...resource,
									name: request.name,
								}
							: resource,
					),
				};
				return {
					type: "success",
					value: project,
				};
			},
		);
		const deleteResourceFn = vi.fn(async (request: { resourceId: string }) => {
			project = {
				...project,
				revision: project.revision + 1,
				resources: project.resources.filter(({ id }) => id !== request.resourceId),
				config: {
					...project.config,
					...(type === "music"
						? {
								music: {
									playlist: [],
								},
							}
						: {
								sfx: {
									events: {},
								},
							}),
				},
			};
			return {
				type: "success",
				value: project,
			};
		});
		const audioConstructor = vi.fn();
		vi.stubGlobal("Audio", audioConstructor);
		vi.stubGlobal("arkini", {
			editor: {
				saveResourceMetadataFn,
				deleteResourceFn,
			},
			lifecycle: {
				onCloseFailedFn: () => () => undefined,
			},
		});
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
		const detail = createRoute({
			getParentRoute: () => editor,
			path: `${type}/$resourceId/$sectionId`,
			component: () => {
				const { resourceId, sectionId } = detail.useParams();
				// Keep the same route component mounted: the production detail must own its draft identity.
				return (
					<EditorAudioResourceDetail
						resourceId={resourceId}
						type={type}
						section={
							sectionId === "edit"
								? "edit"
								: sectionId === "delete"
									? "delete"
									: "view"
						}
					/>
				);
			},
		});
		const list = createRoute({
			getParentRoute: () => editor,
			path: type,
			component: () => <div>Library</div>,
		});
		const initialPath = `/editor/${state.projectId}/${type}/first/edit`;
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				editor.addChildren([
					detail,
					list,
				]),
			]),
			history: createMemoryHistory({
				initialEntries: [
					initialPath,
				],
			}),
			defaultPendingMs: 60_000,
		});
		await router.load();
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		const fieldFn = () =>
			host.querySelector<HTMLInputElement>('[data-ui="EditorTextControlInput"]')!;
		const changeFn = async (value: string) =>
			act(async () => {
				const input = fieldFn();
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
					input,
					value,
				);
				input.dispatchEvent(
					new Event("input", {
						bubbles: true,
					}),
				);
			});
		const shortcutFn = async () =>
			act(async () =>
				fieldFn().dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "s",
						code: "KeyS",
						ctrlKey: true,
						bubbles: true,
						cancelable: true,
					}),
				),
			);
		const dialogButtonFn = async (label: string) =>
			act(async () => {
				const button = Array.from(
					host.querySelectorAll<HTMLButtonElement>(
						'[data-ui="EditorUnsavedChangesDialog"] button',
					),
				).find((candidate) => candidate.textContent === label);
				if (button === undefined) throw new Error(`Missing dialog ${label}`);
				button.click();
			});
		try {
			await act(async () =>
				root.render(
					<RegistryContext.Provider value={RendererAtomRegistry}>
						<TranslationTestProvider>
							<HotkeysProvider
								defaultOptions={{
									hotkey: {
										platform: "linux",
									},
								}}
							>
								<RouterProvider router={router} />
							</HotkeysProvider>
						</TranslationTestProvider>
					</RegistryContext.Provider>,
				),
			);
			expect(fieldFn().value).toBe("First recording");
			await changeFn("Draft for first");
			let navigation: Promise<void> | undefined;
			await act(async () => {
				navigation = router.navigate({
					to: `/editor/${state.projectId}/${type}/second/edit`,
				});
			});
			await vi.waitFor(() =>
				expect(host.querySelector('[data-ui="EditorUnsavedChangesDialog"]')).not.toBeNull(),
			);
			expect(router.state.location.pathname).toBe(initialPath);
			await dialogButtonFn("Cancel");
			expect(fieldFn().value).toBe("Draft for first");
			await shortcutFn();
			await vi.waitFor(() => expect(saveResourceMetadataFn).toHaveBeenCalledOnce());
			expect(saveResourceMetadataFn).toHaveBeenLastCalledWith({
				projectId: state.projectId,
				expectedRevision: 0,
				resourceId: "first",
				name: "Draft for first",
			});
			await act(async () => {
				navigation = router.navigate({
					to: `/editor/${state.projectId}/${type}/second/edit`,
				});
			});
			await vi.waitFor(() =>
				expect(host.querySelector('[data-ui="EditorUnsavedChangesDialog"]')).not.toBeNull(),
			);
			await dialogButtonFn("Discard");
			await act(async () => {
				await navigation;
			});
			expect(fieldFn().value).toBe("Second recording");
			await act(async () => completeFirstFn());
			await vi.waitFor(() => expect(RendererAtomRegistry.get(atom)?.revision).toBe(1));
			expect(router.state.location.pathname).toBe(
				`/editor/${state.projectId}/${type}/second/edit`,
			);
			expect(fieldFn().value).toBe("Second recording");
			expect(audioConstructor).not.toHaveBeenCalled();
			await changeFn("Second renamed");
			await shortcutFn();
			await vi.waitFor(() =>
				expect(router.state.location.pathname).toBe(
					`/editor/${state.projectId}/${type}/second/view`,
				),
			);
			expect(saveResourceMetadataFn).toHaveBeenLastCalledWith({
				projectId: state.projectId,
				expectedRevision: 1,
				resourceId: "second",
				name: "Second renamed",
			});
			expect(RendererAtomRegistry.get(atom)?.resources).toEqual([
				{
					...project.resources[0],
					name: "Draft for first",
				},
				{
					...project.resources[1],
					name: "Second renamed",
				},
			]);
			expect(RendererAtomRegistry.get(atom)?.config).toEqual(originalConfig);
			expect(audioConstructor).not.toHaveBeenCalled();
			await act(async () => {
				await router.navigate({
					to: `/editor/${state.projectId}/${type}/second/delete`,
				});
			});
			expect(
				host.querySelector('[data-ui="EditorAudioResourceUsage"]')?.textContent,
			).toContain(type === "music" ? "Playlist" : "Job started");
			await act(async () =>
				host.querySelector<HTMLButtonElement>('[data-ui="EditorAudioDeleteOpen"]')!.click(),
			);
			expect(deleteResourceFn).not.toHaveBeenCalled();
			await act(async () =>
				host
					.querySelector<HTMLButtonElement>('[data-ui="EditorAudioDeleteConfirm"]')!
					.click(),
			);
			await vi.waitFor(() =>
				expect(router.state.location.pathname).toBe(`/editor/${state.projectId}/${type}`),
			);
			await vi.waitFor(() =>
				expect(
					RendererAtomRegistry.get(atom)?.resources.some(({ id }) => id === "second"),
				).toBe(false),
			);
			expect(deleteResourceFn).toHaveBeenCalledWith({
				projectId: state.projectId,
				expectedRevision: 2,
				resourceId: "second",
			});
		} finally {
			completeFirstFn();
			await act(async () => root.unmount());
			releaseFn();
			host.remove();
			vi.unstubAllGlobals();
		}
	},
);
