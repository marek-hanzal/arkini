import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCachedGameEngineResourceFx } from "~/bridge/game/getCachedGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { resolveLauncherLeaveDestination } from "~/ui/navigation/resolveLauncherLeaveDestination";

export const Route = createFileRoute("/_launcher")({
	beforeLoad: ({ context, location }) => {
		const resource = RendererRuntime.runSync(
			getCachedGameEngineResourceFx(context.queryClient),
		);
		if (resource === null || location.pathname === "/settings") return;
		throw redirect({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: resource.game.arkpack.packageId,
			},
			search: resolveLauncherLeaveDestination(location.pathname),
			replace: true,
		});
	},
	component: Outlet,
});
