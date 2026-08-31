import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { GameEngineResourceFx } from "~/renderer/game/resource/GameEngineResourceFx";
import { ActionLoadingScreen } from "~/launcher/ui/ActionLoadingScreen";

export const Route = createFileRoute("/game/$packageId/action/reset")({
	loader: async ({ context, params }) => {
		try {
			await context.rendererRuntime.runPromise(
				runActionRouteFx(
					GameEngineResourceFx.pipe(
						Effect.flatMap((service) =>
							service.resetFx({
								resource: context.gameEngineResource,
							}),
						),
					),
				),
			);
		} catch (cause) {
			throw context.gameEngineResource.markCriticalFailure("game-reset", cause);
		}
		throw redirect({
			to: "/action/load-game/$packageId",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionLoadingScreen label="Destroying current progress…" />,
});
