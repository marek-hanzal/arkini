import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { claimGameEngineResourceForCloseFx } from "~/bridge/game/claimGameEngineResourceForCloseFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";

/**
 * Publishes one exact Game resource to all descendants and rejects stale package
 * URLs. Ordinary game routes require a usable resource. Controlled exit instead
 * claims the close-claimed resource because final save/disposal must remain
 * reachable after normal scene use has been intentionally forbidden.
 */
export const Route = createFileRoute("/game/$packageId")({
	beforeLoad: ({ context, location, params }) => {
		const controlledClose = location.pathname.endsWith("/action/exit");
		const resource = context.rendererRuntime.runSync(
			controlledClose
				? claimGameEngineResourceForCloseFx()
				: readCurrentGameEngineResourceFx(),
		);
		if (resource === null || resource.game.arkpack.packageId !== params.packageId) {
			throw redirect({
				to: "/action/load-game/$packageId",
				params,
				replace: true,
			});
		}
		if (!controlledClose) resource.assertUsable();
		return {
			gameEngine: resource.game,
			gameEngineResource: resource,
		};
	},
	component: Outlet,
});
