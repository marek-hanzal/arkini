import { createRouter, type Router } from "@tanstack/react-router";
import { Effect } from "effect";
import { routeTree } from "~/_route";
import type { RootContext } from "~/application-shell/context/RootContext";
import { resolveRouteViewTransitionTypesFx } from "~/application-shell/fx/resolveRouteViewTransitionTypesFx";

const isSkippedViewTransition = (error: unknown) =>
	typeof error === "object" &&
	error !== null &&
	"name" in error &&
	(error.name === "AbortError" || error.name === "InvalidStateError");

const observeSkippedViewTransition = (transition: ViewTransition) => {
	void transition.ready.catch((error: unknown) => {
		if (!isSkippedViewTransition(error)) throw error;
	});
};

/**
 * Creates the one process router around an explicit renderer-runtime context.
 * Routes may borrow that authority; router or React lifetime must not recreate it.
 */
export const createArkiniRouterFx = Effect.fn("createArkiniRouterFx")((context: RootContext) =>
	Effect.sync(() => {
		const supportsTypedViewTransitions =
			typeof window !== "undefined" &&
			typeof window.CSS?.supports === "function" &&
			window.CSS.supports("selector(:active-view-transition-type(arkini))");
		const router = createRouter({
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
			scrollToTopSelectors: [
				'[data-scroll-restoration-id="editor-asset-list"]',
				'[data-scroll-restoration-id="editor-estimate-list"]',
				'[data-scroll-restoration-id="editor-item-list"]',
				'[data-scroll-restoration-id="editor-item-type-picker"]',
				'[data-scroll-restoration-id="editor-section-page"]',
			],
		});
		const startRouterViewTransition = router.startViewTransition.bind(router);
		router.startViewTransition = (update) => {
			if (
				typeof document === "undefined" ||
				typeof document.startViewTransition !== "function"
			) {
				startRouterViewTransition(update);
				return;
			}
			const startNativeViewTransition = document.startViewTransition;
			const ownStartViewTransition = Object.getOwnPropertyDescriptor(
				document,
				"startViewTransition",
			);
			const guardedStartViewTransition = ((
				...args: Parameters<typeof document.startViewTransition>
			) => {
				const transition = Reflect.apply(startNativeViewTransition, document, args);
				observeSkippedViewTransition(transition);
				return transition;
			}) as typeof document.startViewTransition;
			Object.defineProperty(document, "startViewTransition", {
				configurable: true,
				value: guardedStartViewTransition,
			});
			try {
				startRouterViewTransition(update);
			} finally {
				if (document.startViewTransition === guardedStartViewTransition) {
					if (ownStartViewTransition === undefined) {
						Reflect.deleteProperty(document, "startViewTransition");
					} else {
						Object.defineProperty(
							document,
							"startViewTransition",
							ownStartViewTransition,
						);
					}
				}
			}
		};
		return router;
	}),
);

export type ArkiniRouter = Router<typeof routeTree, "never", false>;

declare module "@tanstack/react-router" {
	interface Register {
		router: ArkiniRouter;
	}
}
