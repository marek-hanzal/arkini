// @vitest-environment jsdom

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementBoundary } from "~/authoring-session/ui/EditorProjectReplacementBoundary";
import { useEditorProjectRefreshController } from "~/authoring-session/ui/useEditorProjectRefreshController";
import { useProjectFormController } from "~/project-authoring/ui/useProjectFormController";
import { useFormController } from "~/item-authoring/ui/useFormController";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorFormContent } from "~/editor-control/ui/EditorFormContent";
import type { Project } from "~/project-authoring/type/Project";
import {
	editorTestConfig,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

const projectId = "conflict-refresh";
const projectAtom = EditorProjectAtom(projectId);
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => useAtomValue(projectAtom),
}));
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it.each([
	[
		"project",
		"SidebarRefresh",
	],
	[
		"item",
		"EditorConflictRefresh",
	],
] as const)(
	"clears a rejected %s save on Refresh and saves against the fresh revision",
	async (kind, refreshMarker) => {
		const project: Project = {
			projectId,
			title: editorTestConfig.meta.title,
			version: {
				major: 1,
				minor: 0,
			},
			createdAtMs: 1,
			updatedAtMs: 1,
			revision: 1,
			config: editorTestConfig,
			resources: editorTestResources,
		};
		const fresh = {
			...project,
			revision: 2,
			updatedAtMs: 2,
		};
		const releaseFn = RendererAtomRegistry.mount(projectAtom);
		RendererAtomRegistry.set(projectAtom, {
			replacement: project,
		});
		const { resources: _resources, ...freshCommit } = fresh;
		const writeFn = vi.fn(
			async (request: { expectedRevision: number; config?: Project["config"] }) =>
				request.expectedRevision !== 2
					? {
							type: "failure",
							error: {
								operation: kind === "project" ? "replace-config" : "upsert-item",
								reason: "revision-conflict",
								message:
									"Editor project changed from revision 1 to 2 before this write could commit.",
							},
						}
					: {
							type: "success",
							value: {
								...freshCommit,
								revision: 3,
								previousRevision: 2,
								config: request.config ?? fresh.config,
								title: request.config?.meta.title ?? fresh.title,
							},
						},
		);
		const refreshFn = vi.fn(
			async (): Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>> => ({
				type: "success",
				value: fresh,
			}),
		);
		if (kind === "item")
			refreshFn.mockResolvedValueOnce({
				type: "failure",
				error: {
					operation: "refresh-project",
					message: "Could not read project.",
				},
			});
		const logFn = vi.fn(async () => undefined);
		vi.stubGlobal("arkini", {
			diagnostics: {
				writeApplicationFn: logFn,
			},
			editor: {
				replaceConfigFn: writeFn,
				upsertItemFn: writeFn,
				awaitIdleFn: async () => ({
					type: "success",
					value: undefined,
				}),
				refreshProjectFn: refreshFn,
			},
		});
		vi.stubGlobal("scrollTo", vi.fn());
		let controller!: {
			editFn: () => void;
			saveFn: () => Promise<boolean>;
			error: unknown;
		};
		const ProjectProbe = () => {
			const form = useProjectFormController({
				onInvalidDestinationFn: () => undefined,
			});
			controller = {
				editFn: () => form.form.setFieldValue("title", "Changed"),
				saveFn: form.saveFn,
				error: form.error,
			};
			return (
				<EditorFormContent
					error={form.error}
					saveFn={form.saveFn}
				/>
			);
		};
		const ItemProbe = () => {
			const current = useEditorProject();
			const form = useFormController({
				initialItem: current.config.items.water!,
				isNew: false,
				onInvalidSectionFn: () => undefined,
			});
			controller = {
				editFn: () => form.form.setFieldValue("title", "Changed"),
				saveFn: form.saveFn,
				error: form.error,
			};
			return (
				<EditorFormContent
					error={form.error}
					saveFn={form.saveFn}
				/>
			);
		};
		const Scene = () => {
			const refresh = useEditorProjectRefreshController({
				projectId,
				blocked: false,
			});
			return (
				<>
					<button
						data-ui="SidebarRefresh"
						onClick={refresh.refreshFn}
					>
						Refresh
					</button>
					{kind === "project" ? <ProjectProbe /> : <ItemProbe />}
				</>
			);
		};
		const rootRoute = createRootRoute();
		const route = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor/$projectId",
			component: () => (
				<EditorProjectReplacementBoundary>
					<Scene />
				</EditorProjectReplacementBoundary>
			),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				route,
			]),
			history: createMemoryHistory({
				initialEntries: [
					`/editor/${projectId}`,
				],
			}),
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
			await act(async () => controller.editFn());
			await act(async () => {
				await controller.saveFn().catch(() => undefined);
			});
			expect(writeFn).toHaveBeenCalledOnce();
			expect(controller.error).toBeDefined();
			await act(async () =>
				host.querySelector<HTMLButtonElement>(`[data-ui="${refreshMarker}"]`)!.click(),
			);
			if (kind === "item") {
				await vi.waitFor(() =>
					expect(host.textContent).toContain("Could not read project."),
				);
				expect(RendererAtomRegistry.get(projectAtom)?.revision).toBe(1);
				expect(logFn).toHaveBeenCalledWith(
					expect.objectContaining({
						message: "Editor refresh failed",
						body: expect.stringContaining("read-disk"),
					}),
				);
				await act(async () =>
					host
						.querySelector<HTMLButtonElement>('[data-ui="EditorConflictRefresh"]')!
						.click(),
				);
			}
			await vi.waitFor(() => expect(RendererAtomRegistry.get(projectAtom)?.revision).toBe(2));
			expect(controller.error).toBeUndefined();
			await act(async () => controller.editFn());
			await act(async () => {
				expect(await controller.saveFn()).toBe(true);
			});
			expect(writeFn).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 2,
				}),
			);
		} finally {
			await act(async () => root.unmount());
			releaseFn();
			host.remove();
			vi.unstubAllGlobals();
		}
	},
);
