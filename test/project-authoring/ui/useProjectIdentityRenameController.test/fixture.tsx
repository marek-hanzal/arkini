import { RegistryContext } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { bootstrapEditorMcpVersionCheckoutFx } from "~/authoring-mcp/fx/bootstrapEditorMcpVersionCheckoutFx";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { useEditorNavigationBlocker } from "~/authoring-shell/ui/useEditorNavigationBlocker";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { Project } from "~/project-authoring/type/Project";
import { useProjectIdentityRenameController } from "~/project-authoring/ui/useProjectIdentityRenameController";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const project: Project = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 2,
	config: {
		...editorTestPayload.config,
		meta: {
			...editorTestPayload.config.meta,
			id: "project-one",
		},
	},
	resources: editorTestPayload.resources,
};

/** Keeps only Electron responses and route completion controllable; the controller and admission are real. */
export const mountIdentityRenameFn = async (outcome: "success" | "failure" = "success") => {
	const commitGate = Effect.runSync(Deferred.make<void>());
	const routeGate = Effect.runSync(Deferred.make<void>());
	const routeStarted = Effect.runSync(Deferred.make<void>());
	let physicalId = project.projectId;
	const replaceConfigFn = vi.fn<Window["arkini"]["editor"]["replaceConfigFn"]>(
		async (request) => {
			await Effect.runPromise(Deferred.await(commitGate));
			if (outcome === "failure")
				return {
					type: "failure",
					error: {
						operation: "replace-config",
						message: "Rename failed.",
					},
				};
			physicalId = GameConfigSchema.parse(request.config).meta.id;
			return {
				type: "success",
				value: {
					projectId: physicalId,
					title: project.title,
					version: project.version,
					createdAtMs: 1,
					updatedAtMs: 3,
					previousRevision: 2,
					revision: 3,
					config: request.config,
				},
			};
		},
	);
	const awaitIdleFn = vi.fn(async () => ({
		type: "success",
		value: undefined,
	}));
	const readVersionStatusFn = vi.fn(async () => ({
		type: "failure",
		error: {
			operation: "read-version-status",
			message: "Old project no longer exists.",
		},
	}));
	const originalArkini = Object.getOwnPropertyDescriptor(window, "arkini");
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				replaceConfigFn,
				awaitIdleFn,
				readVersionStatusFn,
			},
		},
	});
	let controller!: useProjectIdentityRenameController.Output;
	const Shell = () => {
		useEditorNavigationBlocker();
		controller = useProjectIdentityRenameController({
			project,
		});
		return createElement("p", null, "Identity");
	};
	const rootRoute = createRootRoute();
	const editorRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/project/detail/$sectionId",
		component: Shell,
		loader: async ({ params }) => {
			if (params.projectId !== "project-two") return;
			Effect.runSync(Deferred.succeed(routeStarted, undefined));
			await Effect.runPromise(Deferred.await(routeGate));
		},
	});
	const historyRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/versions/history",
		component: () => createElement("p", null, "History"),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			editorRoute,
			historyRoute,
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/editor/project-one/project/detail/general",
			],
		}),
	});
	await router.load();
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	let checkoutFn!: (request: { projectId: string; versionId: string }) => Promise<void>;
	const unsubscribeFn = RendererRuntime.runSync(
		bootstrapEditorMcpVersionCheckoutFx({
			editorMcp: {
				onVersionCheckoutRequestedFn: (listenerFn) => {
					checkoutFn = listenerFn;
					return () => undefined;
				},
			},
			rendererRuntime: RendererRuntime,
			router: router as never,
		}),
	);
	await act(async () =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: RendererRuntime.runSync(AtomRegistry.AtomRegistry),
				},
				createElement(RouterProvider, {
					router,
				}),
			),
		),
	);
	await act(async () => controller.openFn());
	return {
		admission: RendererRuntime.runSync(ProjectWriteAdmission),
		owner: RendererRuntime.runSync(EditorUnsavedChanges),
		awaitIdleFn,
		checkoutFn,
		readVersionStatusFn,
		replaceConfigFn,
		router,
		readControllerFn: () => controller,
		readPhysicalIdFn: () => physicalId,
		releaseCommitFn: () => Effect.runSync(Deferred.succeed(commitGate, undefined)),
		releaseRouteFn: () => Effect.runSync(Deferred.succeed(routeGate, undefined)),
		waitRouteFn: () => Effect.runPromise(Deferred.await(routeStarted)),
		unmountFn: async () => {
			Effect.runSync(Deferred.succeed(commitGate, undefined));
			Effect.runSync(Deferred.succeed(routeGate, undefined));
			unsubscribeFn();
			await act(async () => root.unmount());
			host.remove();
			if (originalArkini === undefined) Reflect.deleteProperty(window, "arkini");
			else Object.defineProperty(window, "arkini", originalArkini);
		},
	};
};
