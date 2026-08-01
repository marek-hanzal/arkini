import { Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { EditorFormDirtyAtom } from "~/bridge/editor/EditorFormDirtyAtom";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { claimGameEngineResourceForCloseFx } from "~/bridge/game/claimGameEngineResourceForCloseFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import { waitForActionLoadingCompletionFrameFx } from "~/ui/loading/waitForActionLoadingCompletionFrameFx";
import type { RootContext } from "~/ui/root/RootContext";

export namespace installRendererControlledCloseFx {
	export interface Props {
		readonly lifecycle: Pick<
			Window["arkini"]["lifecycle"],
			"onBeforeClose" | "onBeforeCloseReady"
		>;
		readonly rendererRuntime: RootContext["rendererRuntime"];
		readonly router: Pick<ArkiniRouter, "navigate">;
	}
}

/**
 * Installs the renderer-owned half of the native close handshake.
 *
 * The first callback claims an active or provisional Game before route
 * interruption can orphan it, then delegates final save/disposal to the terminal
 * exit route. The second callback waits for that route's completed presentation
 * frame. This owner coordinates the handshake; it never saves or disposes a Game
 * itself.
 */
export const installRendererControlledCloseFx = Effect.fn("installRendererControlledCloseFx")(
	({ lifecycle, rendererRuntime, router }: installRendererControlledCloseFx.Props) =>
		Effect.sync(() => {
			let exitPresentationRequired = false;

			const removeBeforeClose = lifecycle.onBeforeClose(async () => {
				exitPresentationRequired = false;
				const exit = await rendererRuntime.runPromiseExit(
					claimGameEngineResourceForCloseFx(),
				);
				if (Exit.isFailure(exit)) {
					const failure = readExactCauseFailure(exit.cause);
					throw Option.isSome(failure) ? failure.value : exit.cause;
				}
				const resource = exit.value;
				if (resource === null) {
					const formDirty = await rendererRuntime.runPromise(
						Atom.get(EditorFormDirtyAtom),
					);
					if (formDirty) {
						throw new Error(
							"Save or discard the current editor changes before closing.",
						);
					}
					await rendererRuntime.runPromise(
						Effect.flatMap(
							EditorProjectRepository,
							(repository) => repository.awaitIdleFx,
						),
					);
					const catalog = await rendererRuntime.runPromise(
						Atom.get(ArkpackCatalogOwnerAtom),
					);
					if (catalog !== undefined)
						await rendererRuntime.runPromise(catalog.awaitIdleFx);
					return;
				}
				exitPresentationRequired = true;
				// Route ownership keeps finalization identical for UI-requested and native close.
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
				// Native close may continue only after the completed route has painted once.
				await rendererRuntime.runPromise(waitForActionLoadingCompletionFrameFx());
			});

			return () => {
				removeBeforeClose();
				removeBeforeCloseReady();
			};
		}),
);
