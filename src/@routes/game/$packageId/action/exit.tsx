import { createFileRoute } from "@tanstack/react-router";

import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";

export const Route = createFileRoute("/game/$packageId/action/exit")({
	loader: async ({ context }) => {
		await runActionRoute(() =>
			RendererRuntime.runPromise(
				releaseGameEngineResourceFx({
					queryClient: context.queryClient,
					resource: context.gameEngineResource,
				}),
			),
		);
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Saving and exiting Arkini…" />,
	component: () => <ActionPendingPage label="Saving and exiting Arkini…" />,
	errorComponent: (props) => (
		<ActionErrorPage
			{...props}
			description="Arkini kept the frozen Game Engine so the exact same final save can be retried before native shutdown."
			forceExit
			title="Final save failed"
		/>
	),
});
