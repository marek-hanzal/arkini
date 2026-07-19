import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { resolveLauncherLeaveDestination } from "~/ui/navigation/resolveLauncherLeaveDestination";

export const Route = createFileRoute("/_launcher")({
	beforeLoad: ({ context, location }) => {
		const cached = findCachedGameEngine(context.queryClient);
		if (cached === null) return;
		throw redirect({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: cached.packageId,
			},
			search: resolveLauncherLeaveDestination(location.pathname),
			replace: true,
		});
	},
	component: Outlet,
});
