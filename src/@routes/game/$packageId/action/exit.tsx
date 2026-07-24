import { createFileRoute } from "@tanstack/react-router";

import { closeGameEngineResourceFx } from "~/bridge/game/closeGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";

const label = "Saving and exiting Arkini…";

const GameExitCompletedPage = () => (
	<ActionPendingPage
		completed
		label={label}
	/>
);

export const Route = createFileRoute("/game/$packageId/action/exit")({
	loader: async ({ context }) => {
		const result = await runActionRoute(() =>
			RendererRuntime.runPromise(
				closeGameEngineResourceFx({
					queryClient: context.queryClient,
					resource: context.gameEngineResource,
				}),
			),
		);
		if (result.type === "finalization-failed") {
			console.error(
				"Arkini controlled close finalization failed; closing anyway.",
				result.cause,
			);
		}
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label={label} />,
	component: GameExitCompletedPage,
});
