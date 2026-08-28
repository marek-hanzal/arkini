import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { resolveLauncherLeaveDestinationFx } from "~/@routes/-resolveLauncherLeaveDestinationFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";

/**
 * Launcher pages must not silently replace an active Game. Funnel every such
 * request through the route-owned leave action so save/release completes before
 * the requested launcher destination mounts. Settings is the deliberate
 * exception: the in-game menu reuses that route while the Game stays published.
 */
export const Route = createFileRoute("/_launcher")({
	beforeLoad: ({ context, location }) => {
		const resource = context.rendererRuntime.runSync(readCurrentGameEngineResourceFx());
		if (
			resource === null ||
			location.pathname === "/settings" ||
			location.pathname.startsWith("/settings/")
		)
			return;
		throw redirect({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: resource.game.arkpack.packageId,
			},
			search: Effect.runSync(resolveLauncherLeaveDestinationFx(location.pathname)),
			replace: true,
		});
	},
});
