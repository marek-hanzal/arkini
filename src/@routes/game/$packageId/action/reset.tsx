import { createFileRoute, redirect } from "@tanstack/react-router";

import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRouteFx } from "~/page/action/runActionRouteFx";

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
	pendingComponent: () => <ActionPendingPage label="Destroying current progress…" />,
});
