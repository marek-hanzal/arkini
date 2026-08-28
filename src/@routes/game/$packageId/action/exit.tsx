import { createFileRoute } from "@tanstack/react-router";

import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { closeGameEngineResourceFx } from "~/bridge/game/closeGameEngineResourceFx";
import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";

/**
 * Terminal renderer side of the native controlled-close handshake. This route
 * owns or joins one best-effort final save/disposal attempt and then exposes the
 * completed Hero frame. It never requests native close itself; the application
 * lifecycle owner waits for that frame and alone reports renderer readiness to
 * Electron.
 */
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
	pendingComponent: () => <ActionLoadingScreen label="Saving and exiting Arkini…" />,
	component: () => (
		<ActionLoadingScreen
			completed
			label="Saving and exiting Arkini…"
		/>
	),
});
