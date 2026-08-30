import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import { GameEngineProvider } from "~/game-presentation/ui/GameEngineProvider";
import { GameCriticalFailureBoundary } from "~/game-presentation/ui/GameCriticalFailureBoundary";

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
			GameEngineResourceFx.pipe(
				Effect.flatMap((service) =>
					controlledClose ? service.claimForCloseFx : service.currentFx,
				),
			),
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
	component: () => {
		const { gameEngine } = Route.useRouteContext();
		return (
			<GameCriticalFailureBoundary>
				<GameEngineProvider game={gameEngine}>
					<Outlet />
				</GameEngineProvider>
			</GameCriticalFailureBoundary>
		);
	},
});
