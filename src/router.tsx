import { createRouter } from "@tanstack/react-router";
import { routeTree } from "~/_route";
import type { RootContext } from "~/ui/root/RootContext";
import { resolveRouteViewTransitionTypes } from "~/ui/navigation/resolveRouteViewTransitionTypes";

const supportsTypedViewTransitions = () =>
	typeof window !== "undefined" &&
	typeof window.CSS?.supports === "function" &&
	window.CSS.supports("selector(:active-view-transition-type(arkini))");

export const createArkiniRouter = (context: RootContext) =>
	createRouter({
		routeTree,
		context,
		defaultPreload: "intent",
		defaultViewTransition: supportsTypedViewTransitions()
			? {
					types: resolveRouteViewTransitionTypes,
				}
			: false,
		scrollRestoration: true,
	});

export type ArkiniRouter = ReturnType<typeof createArkiniRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: ArkiniRouter;
	}
}
