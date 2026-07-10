import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";

import { FlowPage } from "../flow/graph/ui/FlowPage";
import { DevHomePage } from "../home/ui/DevHomePage";
import { ItemTablePage } from "../table/list/ui/ItemTablePage";
import { DevErrorPage } from "./DevErrorPage";
import { DevRoot } from "./DevRoot";
import { DevShell } from "./DevShell";

const rootRoute = createRootRoute({
	component: DevRoot,
	errorComponent: ({ error }) => <DevErrorPage error={error} />,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: () => {
		throw redirect({
			to: "/dev",
		});
	},
});

const devRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/dev",
	component: DevShell,
});

const devIndexRoute = createRoute({
	getParentRoute: () => devRoute,
	path: "/",
	component: DevHomePage,
});

const tableRoute = createRoute({
	getParentRoute: () => devRoute,
	path: "/table",
	component: ItemTablePage,
});

const flowRoute = createRoute({
	getParentRoute: () => devRoute,
	path: "/flow",
	component: FlowPage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	devRoute.addChildren([
		devIndexRoute,
		tableRoute,
		flowRoute,
	]),
]);

export const router = createRouter({
	routeTree,
	context: {},
	history: createHashHistory(),
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
