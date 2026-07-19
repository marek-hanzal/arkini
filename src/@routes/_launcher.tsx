import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { resolveLauncherLeaveDestination } from "~/ui/navigation/resolveLauncherLeaveDestination";

export const Route = createFileRoute("/_launcher")({
	beforeLoad: ({ context, location }) => {
		const resource = getCachedGameEngineResource(context.queryClient);
		if (resource === null) return;
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
