import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { GameAudio } from "~/ui/audio/GameAudio";

const GameRoute = () => (
	<>
		<GameAudio />
		<Outlet />
	</>
);

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
		resource.assertUsable();
		return {
			gameEngine: resource.game,
			gameEngineResource: resource,
		};
	},
	loader: ({ context }) => context.gameEngine,
	staleTime: Number.POSITIVE_INFINITY,
	gcTime: 0,
	component: GameRoute,
});
