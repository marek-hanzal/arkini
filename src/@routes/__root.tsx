import { createRootRouteWithContext } from "@tanstack/react-router";
import { toCriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import { RootFatalErrorPage } from "~/page/RootFatalErrorPage";
import { RootPage } from "~/page/RootPage";
import type { RootContext } from "~/ui/root/RootContext";

export const Route = createRootRouteWithContext<RootContext>()({
	beforeLoad: async ({ context }) => {
		try {
			await context.previousGameShutdown;
		} catch (cause) {
			throw toCriticalGameLifecycleError({
				operation: "hmr-handoff",
				cause,
			});
		}
	},
	component: RootPage,
	errorComponent: RootFatalErrorPage,
});
