import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { claimGameEngineResourceForCloseFx } from "~/bridge/game/claimGameEngineResourceForCloseFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";

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
