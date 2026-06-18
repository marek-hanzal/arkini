import {
	createHashHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { HomeScreen } from "~/app/HomeScreen";
import { RootErrorBoundary } from "~/app/RootErrorBoundary";
import { RootShell } from "~/app/RootShell";

export interface RouterContext {}

const history = createHashHistory();

export const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: RootShell,
	errorComponent: ({ error }) => <RootErrorBoundary error={error} />,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomeScreen,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
]);

export const router = createRouter({
	routeTree,
	context: {},
	history,
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
