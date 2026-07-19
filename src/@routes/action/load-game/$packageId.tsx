import { createFileRoute, redirect } from "@tanstack/react-router";

import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";

export const Route = createFileRoute("/action/load-game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const cached = findCachedGameEngine(context.queryClient);
		if (cached === null || cached.packageId === params.packageId) return;
		throw redirect({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: cached.packageId,
			},
			search: {
				destination: "game",
				packageId: params.packageId,
			},
			replace: true,
		});
	},
	loader: async ({ context, params }) => {
		await runActionRoute(() =>
			context.queryClient.ensureQueryData(
				gameEngineQueryOptions({
					packageId: params.packageId,
					awaitPreviousShutdown: context.previousGameShutdown,
				}),
			),
		);
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Loading game…" />,
	errorComponent: (props) => (
		<ActionErrorPage
			{...props}
			description="The selected package could not create a playable Game Engine. Retrying reuses the same explicit load action."
			title="Game failed to load"
		/>
	),
});
