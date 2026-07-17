import { createRouter } from "@tanstack/react-router";
import { routeTree } from "~/_route";
import type { RootPage } from "~/page/RootPage";

export const createArkiniRouter = (context: RootPage.Context) =>
	createRouter({
		routeTree,
		context,
		defaultPreload: "intent",
		defaultViewTransition: true,
		scrollRestoration: true,
	});

export type ArkiniRouter = ReturnType<typeof createArkiniRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: ArkiniRouter;
	}
}
