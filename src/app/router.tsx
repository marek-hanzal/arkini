import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	Outlet,
	createHashHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { HomeScreen } from "~/app/HomeScreen";

export interface RouterContext {
	queryClient: QueryClient;
}

export function createArkiniQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: 1000 * 60 * 30,
				refetchOnReconnect: false,
				refetchOnWindowFocus: false,
				retry: 1,
				staleTime: 1000 * 10,
			},
		},
	});
}

const queryClient = createArkiniQueryClient();
const history = createHashHistory();

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: RootShell,
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
	context: {
		queryClient,
	},
	history,
	defaultPreload: "intent",
	scrollRestoration: true,
});

function RootShell() {
	const { queryClient } = rootRoute.useRouteContext();

	return (
		<QueryClientProvider client={queryClient}>
			<Outlet />
		</QueryClientProvider>
	);
}

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
