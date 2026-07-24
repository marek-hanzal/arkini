import { createFileRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";

import { acquireGameEngineResource } from "~/bridge/game/acquireGameEngineResource";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";
import { GameEngineErrorPage } from "~/page/game/GameEngineErrorPage";
import { waitForActiveViewTransition } from "~/ui/navigation/waitForActiveViewTransition";

const redirectToOwnedGame = (ownedPackageId: string, requestedPackageId: string): never => {
	throw redirect({
		to: "/game/$packageId/action/leave",
		params: {
			packageId: ownedPackageId,
		},
		search: {
			destination: "game",
			packageId: requestedPackageId,
		},
		replace: true,
	});
};

export const Route = createFileRoute("/action/load-game/$packageId")({
	beforeLoad: ({ context, params }) => {
		const resource = getCachedGameEngineResource(context.queryClient);
		if (resource === null) return;
		resource.assertUsable();
		if (resource.game.arkpack.packageId === params.packageId) return;
		return redirectToOwnedGame(resource.game.arkpack.packageId, params.packageId);
	},
	loader: async ({ abortController, context, params }) => {
		const acquisition = acquireGameEngineResource({
			queryClient: context.queryClient,
			signal: abortController.signal,
			packageId: params.packageId,
			awaitPreviousShutdown: context.previousGameShutdown,
			beforeCreate: async () => {
				await waitForActiveViewTransition();
				abortController.signal.throwIfAborted();
			},
		});
		const lease = await runActionRoute(() => acquisition);
		if (lease.resource.game.arkpack.packageId !== params.packageId) {
			return redirectToOwnedGame(lease.resource.game.arkpack.packageId, params.packageId);
		}
		const resource = lease.adopt();
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
	errorComponent: GameLoadErrorPage,
});

function GameLoadErrorPage(props: ErrorComponentProps) {
	const { packageId } = Route.useParams();
	return (
		<GameEngineErrorPage
			{...props}
			packageId={packageId}
		/>
	);
}
