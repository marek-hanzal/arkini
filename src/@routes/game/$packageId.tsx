import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { GameEngineErrorPage } from "~/page/game/GameEngineErrorPage";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";

export const Route = createFileRoute("/game/$packageId")({
	beforeLoad: async ({ context, params }) => {
		const cached = findCachedGameEngine(context.queryClient);
		if (cached !== null && cached.packageId !== params.packageId) {
			throw redirect({
				to: "/game/$packageId/action/leave",
				params: {
					packageId: cached.packageId,
				},
				search: {
					destination: "game",
					packageId: params.packageId,
				},
				replace: true,
			});
		}
		const gameEngineResource = await context.queryClient.ensureQueryData(
			gameEngineQueryOptions({
				packageId: params.packageId,
				awaitPreviousShutdown: context.previousGameShutdown,
			}),
		);
		return {
			gameEngine: gameEngineResource.game,
			gameEngineResource,
		};
	},
	loader: ({ context }) => context.gameEngine,
	staleTime: Number.POSITIVE_INFINITY,
	gcTime: 0,
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Loading game…" />,
	errorComponent: GameEngineErrorPage,
	component: Outlet,
});
