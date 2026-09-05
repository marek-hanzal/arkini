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
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorNavigationBlocker } from "~/authoring-shell/ui/useEditorNavigationBlocker";
import { useVersionCommitController } from "~/project-version/ui/useVersionCommitController";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project-one",
	}),
}));
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it.each([
	"mounted",
	"left",
	"pending-route",
])(
	"finishes the Version write but redirects only its unchanged mounted route (%s)",
	async (scenario) => {
		const gate = Effect.runSync(Deferred.make<void>());
		const flowGate = Effect.runSync(Deferred.make<void>());
		const flowStarted = Effect.runSync(Deferred.make<void>());
		let mounted = false;
		let navigation: Promise<void> | undefined;
		const published = Effect.runSync(Deferred.make<void>());
		let committed = false;
		const project = {
			projectId: "project-one",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			revision: 3,
			createdAtMs: 1,
			updatedAtMs: 3,
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					id: "project-one",
				},
			},
			resources: editorTestPayload.resources,
		};
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					onProjectChangedFn: () => () => undefined,
					awaitIdleFn: async () => ({
						type: "success",
						value: undefined,
					}),
					previewVersionCommitFn: async () => ({
						type: "success",
						value: {
							bump: "minor",
							canCommit: true,
							currentFingerprint: "a".repeat(64),
							initial: false,
							nextArkpackVersion: "1.1",
							scenariosToDelete: [],
						},
					}),
					createVersionFn: async () => {
						await Effect.runPromise(Deferred.await(gate));
						committed = true;
						return {
							type: "success",
							value: {
								arkini: ArkiniAppVersion,
								arkpackVersion: "1.1",
								projectId: "project-one",
								sourceRevision: 3,
								subject: "Committed",
								versionId: "version-two",
								createdAtMs: 3,
							},
						};
					},
					readProjectFn: async () => {
						Effect.runSync(Deferred.succeed(published, undefined));
						return {
							type: "success",
							value: project,
						};
					},
				},
			},
		});
		let controller!: useVersionCommitController.Output;
		const Commit = () => {
			controller = useVersionCommitController();
			useLayoutEffect(() => {
				mounted = true;
				return () => {
					mounted = false;
				};
			}, []);
			return createElement("p", null, "Commit");
		};
		const Shell = () => {
			useEditorNavigationBlocker();
			return createElement(Outlet);
		};
		const rr = createRootRoute();
		const er = createRoute({
			getParentRoute: () => rr,
			path: "/editor/$projectId",
			component: Shell,
		});
		const cr = createRoute({
			getParentRoute: () => er,
			path: "versions/commit",
			validateSearch: () => ({}),
			component: Commit,
		});
		const hr = createRoute({
			getParentRoute: () => er,
			path: "versions/history",
			component: () => createElement("p", null, "History"),
		});
		const fr = createRoute({
			getParentRoute: () => er,
			path: "flow",
			loader: async () => {
				Effect.runSync(Deferred.succeed(flowStarted, undefined));
				if (scenario === "pending-route") await Effect.runPromise(Deferred.await(flowGate));
			},
			component: () => createElement("p", null, "Flow"),
		});
		const router = createRouter({
			routeTree: rr.addChildren([
				er.addChildren([
					cr,
					hr,
					fr,
				]),
			]),
			history: createMemoryHistory({
				initialEntries: [
					"/editor/project-one/versions/commit",
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
			await act(async () => controller.setSubjectFn("Committed"));
			expect(controller.canCommit).toBe(true);
			await act(async () => controller.commitFn());
			expect(controller.pending).toBe(true);
			if (scenario !== "mounted") {
				await act(async () => {
					navigation = router.navigate({
						href: "/editor/project-one/flow",
					});
					await Effect.runPromise(Deferred.await(flowStarted));
					if (scenario === "left") await navigation;
				});
				expect(router.state.location.pathname).toBe("/editor/project-one/flow");
				expect(mounted).toBe(scenario === "pending-route");
			}
			expect(committed).toBe(false);
			await act(async () => {
				Effect.runSync(Deferred.succeed(gate, undefined));
				await Effect.runPromise(Deferred.await(published));
				await new Promise<void>((resolveFn) => setTimeout(resolveFn, 0));
			});
			expect(committed).toBe(true);
			expect(router.state.location.pathname).toBe(
				scenario === "mounted"
					? "/editor/project-one/versions/history"
					: "/editor/project-one/flow",
			);
			if (scenario === "pending-route") {
				await act(async () => {
					Effect.runSync(Deferred.succeed(flowGate, undefined));
					await navigation;
				});
				expect(router.state.location.pathname).toBe("/editor/project-one/flow");
			}
		} finally {
			Effect.runSync(Deferred.succeed(gate, undefined));
			Effect.runSync(Deferred.succeed(flowGate, undefined));
			await act(async () => root.unmount());
			host.remove();
			Reflect.deleteProperty(window, "arkini");
		}
	},
);
