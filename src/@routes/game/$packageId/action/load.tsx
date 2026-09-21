import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { z } from "zod";

import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";
import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import { ActionErrorPage } from "~/launcher/ui/ActionErrorPage";
import { ActionLoadingScreen } from "~/launcher/ui/ActionLoadingScreen";

export const Route = createFileRoute("/game/$packageId/action/load")({
	validateSearch: z
		.object({
			slot: GameSaveSlotSchema,
		})
		.strict(),
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) => {
		await context.rendererRuntime.runPromise(
			runActionRouteFx(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.restoreFx({
							resource: context.gameEngineResource,
							slot: deps.slot,
						}),
					),
				),
			),
		);
		throw redirect({
			to: "/action/load-game/$packageId",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionLoadingScreen label="Loading your save…" />,
	errorComponent: ({ error }) => {
		const router = useRouter();
		const { packageId } = Route.useParams();
		const { gameEngineResource } = Route.useRouteContext();
		gameEngineResource.assertUsableFn();
		if (error instanceof CriticalGameLifecycleError) throw error;
		return (
			<ActionErrorPage
				error={error}
				title="This save could not be loaded"
				description="Your current game is unchanged. You can return to it and try another save."
				resetLabel="Return to game"
				resetFn={() => {
					void router.navigate({
						to: "/game/$packageId/board",
						params: {
							packageId,
						},
						replace: true,
					});
				}}
			/>
		);
	},
});
