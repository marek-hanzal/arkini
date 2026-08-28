import { createFileRoute, redirect } from "@tanstack/react-router";

import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";

export const Route = createFileRoute("/game/$packageId/action/reset")({
	loader: async ({ context, params }) => {
		try {
			await context.rendererRuntime.runPromise(
				runActionRouteFx(
					resetGameEngineResourceFx({
						resource: context.gameEngineResource,
					}),
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
