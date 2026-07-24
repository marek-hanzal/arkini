import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import { resolveLauncherLeaveDestination } from "~/ui/navigation/resolveLauncherLeaveDestination";

export const Route = createFileRoute("/_launcher")({
	beforeLoad: ({ context, location }) => {
		const resource = context.rendererRuntime.runSync(readCurrentGameEngineResourceFx());
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
