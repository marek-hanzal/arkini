import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { RouterContext } from "./routerContext";

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

export function getRouter() {
  const queryClient = createArkiniQueryClient();

  return createRouter({
    routeTree,
    context: {
      queryClient,
    } satisfies RouterContext,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}

export type ArkiniRouter = ReturnType<typeof getRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: ArkiniRouter;
  }
}
