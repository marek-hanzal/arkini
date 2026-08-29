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
import type { ArkpackCatalog } from "~/arkpack/renderer/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import { RendererLifecycleOwnerAtom } from "~/renderer/lifecycle/RendererLifecycleOwnerAtom";
import { createRendererLifecycleFx } from "~/renderer/lifecycle/createRendererLifecycleFx";
import { Route as StartupRouteDefinition } from "~/@routes/index";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

const StartupSplash = StartupRouteDefinition.options.component;
if (StartupSplash === undefined) throw new Error("Startup route component is missing.");

export namespace renderStartupSplashFx {
	export interface Props {
		readonly bootstrapFx: Effect.Effect<LauncherStartup.Result, unknown>;
		readonly catalog: ArkpackCatalog;
	}
}

/** Renders the startup route under a fresh real Atom registry. */
export const renderStartupSplashFx = Effect.fn("renderStartupSplashFx")(
	({ bootstrapFx, catalog }: renderStartupSplashFx.Props) =>
		Effect.promise(async () => {
			let resolveVisible!: (value: number) => void;
			const visible = new Promise<number>((resolve) => {
				resolveVisible = resolve;
			});
			const registry = AtomRegistry.make({
				defaultIdleTTL: 400,
				scheduleTask,
			});
			registry.set(ArkpackCatalogOwnerAtom, catalog);
			registry.set(
				RendererLifecycleOwnerAtom,
				Effect.runSync(
					createRendererLifecycleFx({
						forceClose: () => undefined,
						requestClose: () => Promise.resolve(),
						waitUntilVisible: () => visible,
					}),
				),
			);
			registry.set(LauncherStartupConfigAtom, {
				bootstrapFx,
				heroUrl: "/hero.png",
			});
			const Root = () =>
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Outlet),
				);
			const rootRoute = createRootRoute({
				component: Root,
			});
			const indexRoute = createRoute({
				getParentRoute: () => rootRoute,
				path: "/",
				component: StartupSplash,
			});
			const mainMenuRoute = createRoute({
				getParentRoute: () => rootRoute,
				path: "/main-menu",
				component: () => createElement("div", null, "Main menu route"),
			});
			const router = createRouter({
				routeTree: rootRoute.addChildren([
					indexRoute,
					mainMenuRoute,
				]),
				history: createMemoryHistory({
					initialEntries: [
						"/",
					],
				}),
			});
			await router.load();
			const container = document.createElement("div");
			document.body.append(container);
			const root = createRoot(container);
			await act(async () => {
				root.render(
					createElement(RouterProvider, {
						router,
					}),
				);
			});
			return {
				container,
				registry,
				resolveVisible,
				root,
				router,
			};
		}),
);
