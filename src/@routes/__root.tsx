import { createRootRouteWithContext } from "@tanstack/react-router";
import { RootFatalErrorPage } from "~/page/RootFatalErrorPage";
import { RootPage } from "~/page/RootPage";
import type { RootContext } from "~/ui/root/RootContext";

export const Route = createRootRouteWithContext<RootContext>()({
	component: RootPage,
	errorComponent: RootFatalErrorPage,
});
