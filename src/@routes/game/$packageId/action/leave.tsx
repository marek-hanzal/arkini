import { createFileRoute, redirect } from "@tanstack/react-router";

import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";
import { GameLeaveDestinationSchema } from "~/ui/navigation/GameLeaveDestinationSchema";

const redirectToDestination = (destination: GameLeaveDestinationSchema.Type): never => {
	switch (destination.destination) {
		case "about":
			throw redirect({
				to: "/about",
				replace: true,
			});
		case "arkpacks":
			throw redirect({
				to: "/arkpacks",
				replace: true,
			});
		case "main-menu":
			throw redirect({
				to: "/main-menu",
				replace: true,
			});
		case "settings":
			throw redirect({
				to: "/settings",
				replace: true,
			});
		case "game":
			throw redirect({
				to: "/game/$packageId/board",
				params: {
					packageId: destination.packageId,
				},
				replace: true,
			});
	}
};

export const Route = createFileRoute("/game/$packageId/action/leave")({
	validateSearch: GameLeaveDestinationSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await runActionRoute(() =>
			RendererRuntime.runPromise(
				releaseGameEngineResourceFx({
					queryClient: context.queryClient,
					resource: context.gameEngineResource,
				}),
			),
		);
		redirectToDestination(deps);
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Saving and leaving game…" />,
	errorComponent: (props) => (
		<ActionErrorPage
			{...props}
			description="Arkini kept the frozen Game Engine so the exact same final save can be retried."
			forceExit
			title="Final save failed"
		/>
	),
});
