import { createFileRoute, redirect } from "@tanstack/react-router";

import { recoverFailedGameSaveFx } from "~/bridge/game/recoverFailedGameSaveFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";
import { GameSaveRecoverySearchSchema } from "~/ui/navigation/GameSaveRecoverySearchSchema";

export const Route = createFileRoute("/action/recover-game-save")({
	validateSearch: GameSaveRecoverySearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await runActionRoute(() =>
			RendererRuntime.runPromise(
				recoverFailedGameSaveFx({
					packageId: deps.packageId,
					queryClient: context.queryClient,
				}),
			),
		);
		throw redirect({
			to: "/game/$packageId/board",
			params: {
				packageId: deps.packageId,
			},
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Clearing failed save…" />,
	errorComponent: (props) => (
		<ActionErrorPage
			{...props}
			description="Arkini could not clear the exact verified save. The failed query remains available for another retry."
			title="Save recovery failed"
		/>
	),
});
