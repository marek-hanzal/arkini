import { createFileRoute, redirect } from "@tanstack/react-router";

import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";

export const Route = createFileRoute("/game/$packageId/action/reset")({
	loader: async ({ context, params }) => {
		try {
			await runActionRoute(() =>
				RendererRuntime.runPromise(
					resetGameEngineResourceFx({
						queryClient: context.queryClient,
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
