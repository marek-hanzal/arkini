import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import { getCachedGameEngineResourceFx } from "~/bridge/game/getCachedGameEngineResourceFx";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { GameAudio } from "~/ui/audio/GameAudio";
import { CheatItemSpawnProvider } from "~/ui/cheat-spotlight/CheatItemSpawnProvider";

const GameRoute = () => {
	const game = useGameEngine();
	const { queryClient } = Route.useRouteContext();
	return (
		<QueryClientProvider client={queryClient}>
			<CheatItemSpawnProvider game={game}>
				<GameAudio />
				<Outlet />
			</CheatItemSpawnProvider>
		</QueryClientProvider>
	);
};

export const Route = createFileRoute("/game/$packageId")({
	beforeLoad: ({ context, location, params }) => {
		const resource = RendererRuntime.runSync(
			getCachedGameEngineResourceFx(context.queryClient),
		);
		if (resource === null || resource.game.arkpack.packageId !== params.packageId) {
			throw redirect({
				to: "/action/load-game/$packageId",
				params,
				replace: true,
			});
		}
		if (!location.pathname.endsWith("/action/exit")) resource.assertUsable();
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
