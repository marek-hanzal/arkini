import { createRootRouteWithContext } from "@tanstack/react-router";
import { RootPage } from "~/page/RootPage";

export const Route = createRootRouteWithContext<RootPage.Context>()({
	component: RootPage,
});
