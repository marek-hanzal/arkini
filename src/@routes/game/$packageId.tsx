import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";

export const Route = createFileRoute("/game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const resource = getCachedGameEngineResource(context.queryClient);
		if (resource === null || resource.game.arkpack.packageId !== params.packageId) {
			throw redirect({
				to: "/action/load-game/$packageId",
				params,
				replace: true,
			});
		}
		return {
			gameEngine: resource.game,
			gameEngineResource: resource,
		};
	},
	loader: ({ context }) => context.gameEngine,
	staleTime: Number.POSITIVE_INFINITY,
	gcTime: 0,
	component: Outlet,
});
