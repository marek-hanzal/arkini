import type { QueryClient } from "@tanstack/react-query";
import { Cause, Effect, Exit, Option } from "effect";

import { waitForGameEngineResourceFx } from "~/bridge/game/waitForGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { ArkiniRouter } from "~/router";
import { waitForActionLoadingCompletionFrameFx } from "~/ui/loading/waitForActionLoadingCompletionFrameFx";

export namespace installRendererControlledCloseFx {
	export interface Props {
		readonly lifecycle: Pick<
			Window["arkini"]["lifecycle"],
			"onBeforeClose" | "onBeforeCloseReady"
		>;
		readonly queryClient: QueryClient;
		readonly router: Pick<ArkiniRouter, "navigate">;
	}
}

/** Sends active-game native close through the terminal route and its completed Hero frame. */
export const installRendererControlledCloseFx = Effect.fn("installRendererControlledCloseFx")(
	({ lifecycle, queryClient, router }: installRendererControlledCloseFx.Props) =>
		Effect.sync(() => {
			let exitPresentationRequired = false;

			const removeBeforeClose = lifecycle.onBeforeClose(async () => {
				exitPresentationRequired = false;
				const exit = await RendererRuntime.runPromiseExit(
					waitForGameEngineResourceFx(queryClient),
				);
				if (Exit.isFailure(exit)) {
					const failure = Cause.failureOption(exit.cause);
					throw Option.isSome(failure) ? failure.value : Cause.squash(exit.cause);
				}
				const resource = exit.value;
				if (resource === null) return;
				exitPresentationRequired = true;
				await router.navigate({
					to: "/game/$packageId/action/exit",
					params: {
						packageId: resource.game.arkpack.packageId,
					},
					replace: true,
				});
			});
			const removeBeforeCloseReady = lifecycle.onBeforeCloseReady(async () => {
				if (!exitPresentationRequired) return;
				await RendererRuntime.runPromise(waitForActionLoadingCompletionFrameFx());
			});

			return () => {
				removeBeforeClose();
				removeBeforeCloseReady();
			};
		}),
);
