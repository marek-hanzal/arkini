import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";
import { match } from "ts-pattern";

import { GameLeaveDestinationSchema } from "~/@routes/action/-GameLeaveDestinationSchema";
import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { GameEngineResourceFx } from "~/renderer/game/resource/GameEngineResourceFx";
import { ActionLoadingScreen } from "~/launcher/ui/ActionLoadingScreen";

export const Route = createFileRoute("/game/$packageId/action/leave")({
	validateSearch: GameLeaveDestinationSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		try {
			await context.rendererRuntime.runPromise(
				runActionRouteFx(
					GameEngineResourceFx.pipe(
						Effect.flatMap((service) =>
							service.releaseFx({
								resource: context.gameEngineResource,
							}),
						),
					),
				),
			);
		} catch (cause) {
			throw context.gameEngineResource.markCriticalFailure("game-leave", cause);
		}
		return match(deps)
			.with(
				{
					destination: "about",
				},
				() => {
					throw redirect({
						to: "/about",
						replace: true,
					});
				},
			)
			.with(
				{
					destination: "arkpacks",
				},
				() => {
					throw redirect({
						to: "/arkpacks",
						replace: true,
					});
				},
			)
			.with(
				{
					destination: "editor",
				},
				() => {
					throw redirect({
						to: "/editor/welcome",
						replace: true,
					});
				},
			)
			.with(
				{
					destination: "main-menu",
				},
				() => {
					throw redirect({
						to: "/main-menu",
						replace: true,
					});
				},
			)
			.with(
				{
					destination: "settings",
				},
				() => {
					throw redirect({
						to: "/settings",
						replace: true,
					});
				},
			)
			.with(
				{
					destination: "game",
				},
				({ packageId }) => {
					throw redirect({
						to: "/action/load-game/$packageId",
						params: {
							packageId,
						},
						replace: true,
					});
				},
			)
			.exhaustive();
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionLoadingScreen label="Saving and leaving game…" />,
});
