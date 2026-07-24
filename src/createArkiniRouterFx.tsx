import { createRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { routeTree } from "~/_route";
import type { RootContext } from "~/ui/root/RootContext";
import { resolveRouteViewTransitionTypesFx } from "~/ui/navigation/resolveRouteViewTransitionTypesFx";

export const createArkiniRouterFx = Effect.fn("createArkiniRouterFx")((context: RootContext) =>
	Effect.sync(() => {
		const supportsTypedViewTransitions =
			typeof window !== "undefined" &&
			typeof window.CSS?.supports === "function" &&
			window.CSS.supports("selector(:active-view-transition-type(arkini))");
		return createRouter({
			routeTree,
			context,
			defaultPreload: "intent",
			defaultViewTransition: supportsTypedViewTransitions
				? {
						types: (locations) =>
							Effect.runSync(resolveRouteViewTransitionTypesFx(locations)),
					}
				: false,
			scrollRestoration: true,
		});
	}),
);

export type ArkiniRouter = Effect.Success<ReturnType<typeof createArkiniRouterFx>>;

declare module "@tanstack/react-router" {
	interface Register {
		router: ArkiniRouter;
	}
}
