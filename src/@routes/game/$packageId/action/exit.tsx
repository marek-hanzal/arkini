import { createFileRoute } from "@tanstack/react-router";

import { closeGameEngineResourceFx } from "~/bridge/game/closeGameEngineResourceFx";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRouteFx } from "~/page/action/runActionRouteFx";

const label = "Saving and exiting Arkini…";

const GameExitCompletedPage = () => (
	<ActionPendingPage
		completed
		label={label}
	/>
);

export const Route = createFileRoute("/game/$packageId/action/exit")({
	loader: async ({ context }) => {
		const result = await context.rendererRuntime.runPromise(
			runActionRouteFx(closeGameEngineResourceFx(context.gameEngineResource)),
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
