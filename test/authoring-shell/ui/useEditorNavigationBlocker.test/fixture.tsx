// @vitest-environment jsdom

import { RegistryContext } from "@effect/atom-react";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { Deferred, Effect, SubscriptionRef } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, vi } from "vitest";

import { bootstrapEditorMcpVersionCheckoutFx } from "~/authoring-mcp/fx/bootstrapEditorMcpVersionCheckoutFx";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { useEditorNavigationBlocker } from "~/authoring-shell/ui/useEditorNavigationBlocker";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import type { EditorBoardGameResource } from "~/board-scenario/service/EditorBoardGameResource";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import {
	ProjectWriteAdmission,
	type ProjectWriteAdmissionService,
} from "~/project-authoring/service/ProjectWriteAdmission";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const state = vi.hoisted(() => ({
	writeAdmission: undefined as ProjectWriteAdmissionService | undefined,
}));

vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: () => state.writeAdmission,
	},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	state.writeAdmission = undefined;
});

export const createFixture = async (navigationLoader?: () => Promise<void>) => {
	const project = {
		projectId: "project-one",
		title: editorTestPayload.config.meta.title,
		version: editorTestPayload.version,
		createdAtMs: 1,
		updatedAtMs: 2,
		revision: 2,
		config: editorTestPayload.config,
		resources: editorTestPayload.resources,
	};
	const releaseGate = Effect.runSync(Deferred.make<void>());
	const releaseStarted = Effect.runSync(Deferred.make<void>());
	const writeGate = Effect.runSync(Deferred.make<void>());
	const writeStarted = Effect.runSync(Deferred.make<void>());
	const writeFx = Deferred.succeed(writeStarted, undefined).pipe(
		Effect.andThen(Deferred.await(writeGate)),
	);
	const checkoutVersionFx = vi.fn(() => writeFx);
	const { rendererRuntime, atomRegistry } = createTestRendererRuntime({
		createResourceFx: () => Effect.never,
		editorProjectRepository: {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected project create."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			listProjectsFx: Effect.die("Unexpected project list."),
			replaceConfigFx: () => Effect.die("Unexpected config write."),
			replaceResourceFx: () => Effect.die("Unexpected resource write."),
			upsertItemFx: () => Effect.die("Unexpected item write."),
			upsertResourcesFx: () => Effect.die("Unexpected resource write."),
			checkoutVersionFx,
			readProjectFx: () => Effect.succeed(project),
			readVersionStatusFx: () =>
				Effect.succeed({
					canCommit: true,
					currentFingerprint: "a".repeat(64),
					dirty: true,
					versionCount: 1,
				}),
		},
	});
	const refreshProjectFn = vi.fn(async () => {
		await rendererRuntime.runPromise(writeFx);
		return {
			type: "success" as const,
			value: project,
		};
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				refreshProjectFn,
			},
		},
	});
	const unsaved = rendererRuntime.runSync(EditorUnsavedChanges);
	const admission = rendererRuntime.runSync(ProjectWriteAdmission);
	state.writeAdmission = admission;
	const syncFx = vi.fn(() => Effect.void);
	const board: EditorBoardGameResource = {
		state: Effect.runSync(
			SubscriptionRef.make<EditorBoardGameResource.State>({
				type: "idle",
			}),
		),
		syncFx,
		publishFx: () => Effect.void,
		replaceFx: () => Effect.void,
		shutdownFx: Effect.void,
		releaseCurrentFx: Deferred.succeed(releaseStarted, undefined).pipe(
			Effect.andThen(Deferred.await(releaseGate)),
		),
	};
	atomRegistry.set(EditorBoardGameResourceOwnerAtom, board);
	const Shell = () => {
		useEditorNavigationBlocker();
		return createElement(Outlet);
	};
	const rootRoute = createRootRoute();
	const editor = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId",
		component: Shell,
		loader: ({ params }) =>
			params.projectId === "project-two" ? navigationLoader?.() : undefined,
	});
	const leaf = (path: "draft" | "versions/history") =>
		createRoute({
			getParentRoute: () => editor,
			path,
			component: () => createElement("p", null, path),
		});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			editor.addChildren([
				leaf("draft"),
				leaf("versions/history"),
			]),
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/editor/project-one/draft",
			],
		}),
		defaultPendingMs: 60_000,
	});
	await router.load();
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	cleanups.push(async () => {
		Effect.runSync(Deferred.succeed(releaseGate, undefined));
		Effect.runSync(Deferred.succeed(writeGate, undefined));
		await act(async () => root.unmount());
		host.remove();
		Reflect.deleteProperty(window, "arkini");
		await rendererRuntime.dispose();
	});
	await act(async () =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: atomRegistry,
				},
				createElement(RouterProvider, {
					router,
				}),
			),
		),
	);
	let checkout:
		| ((request: { projectId: string; versionId: string }) => Promise<void>)
		| undefined;
	rendererRuntime.runSync(
		bootstrapEditorMcpVersionCheckoutFx({
			editorMcp: {
				onVersionCheckoutRequestedFn: (listener) => {
					checkout = listener;
					return () => undefined;
				},
			},
			rendererRuntime,
			router: router as unknown as Pick<ArkiniRouter, "navigate" | "state">,
		}),
	);
	if (checkout === undefined) throw new Error("Expected checkout handler.");
	return {
		checkout,
		admission,
		checkoutVersionFx,
		project,
		refreshProjectFn,
		releaseGate,
		releaseStarted,
		rendererRuntime,
		router,
		syncFx,
		unsaved,
		writeGate,
		writeStarted,
	};
};
