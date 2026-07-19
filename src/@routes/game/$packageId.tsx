import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";

export const Route = createFileRoute("/game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const cached = findCachedGameEngine(context.queryClient);
		if (cached === null || cached.packageId !== params.packageId) {
			throw redirect({
				to: "/action/load-game/$packageId",
				params,
				replace: true,
			});
		}
		return {
			gameEngine: cached.game,
			gameEngineResource: cached.resource,
		};
	},
	loader: ({ context }) => context.gameEngine,
	staleTime: Number.POSITIVE_INFINITY,
	gcTime: 0,
	component: Outlet,
});
