import { createFileRoute, redirect } from "@tanstack/react-router";

import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRouteFx } from "~/page/action/runActionRouteFx";
import { GameLeaveDestinationSchema } from "~/ui/navigation/GameLeaveDestinationSchema";

export const Route = createFileRoute("/game/$packageId/action/leave")({
	validateSearch: GameLeaveDestinationSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		try {
			await context.rendererRuntime.runPromise(
				runActionRouteFx(
					releaseGameEngineResourceFx({
						resource: context.gameEngineResource,
					}),
				),
			);
		} catch (cause) {
			throw context.gameEngineResource.markCriticalFailure("game-leave", cause);
		}
		switch (deps.destination) {
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
					to: "/action/load-game/$packageId",
					params: {
						packageId: deps.packageId,
					},
					replace: true,
				});
		}
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Saving and leaving game…" />,
});
