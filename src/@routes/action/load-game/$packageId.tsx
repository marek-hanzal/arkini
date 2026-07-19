import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";
import { GameEngineErrorPage } from "~/page/game/GameEngineErrorPage";
import { waitForActiveViewTransition } from "~/ui/navigation/waitForActiveViewTransition";

export const Route = createFileRoute("/action/load-game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const resource = getCachedGameEngineResource(context.queryClient);
		if (resource === null) return;
		resource.assertUsable();
		if (resource.game.arkpack.packageId === params.packageId) return;
		throw redirect({
			to: "/game/$packageId/action/leave",
			params: {
				packageId: resource.game.arkpack.packageId,
			},
			search: {
				destination: "game",
				packageId: params.packageId,
			},
			replace: true,
		});
	},
	loader: async ({ abortController, context, params }) => {
		const acquisition = context.queryClient.ensureQueryData(
			gameEngineQueryOptions({
				packageId: params.packageId,
				awaitPreviousShutdown: context.previousGameShutdown,
				beforeCreate: async () => {
					await waitForActiveViewTransition();
					abortController.signal.throwIfAborted();
				},
			}),
		);
		const resource = await runActionRoute(() => acquisition);
		if (resource.game.arkpack.packageId !== params.packageId) {
			throw resource.markCriticalFailure(
				"engine-ownership",
				new Error(
					`Game Engine singleton owns package ${resource.game.arkpack.packageId}, not requested package ${params.packageId}.`,
				),
			);
		}
		resource.assertUsable();
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Loading game…" />,
	errorComponent: GameEngineErrorPage,
});
