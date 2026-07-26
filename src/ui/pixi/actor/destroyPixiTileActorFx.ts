import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorVisualFx } from "~/ui/pixi/actor/destroyPixiTileActorVisualFx";

/** Cancels every visual revision before physically destroying one actor instance exactly once. */
export const destroyPixiTileActorFx = Effect.fn("destroyPixiTileActorFx")(function* (
	actor: PixiTileActor,
) {
	if (actor.container.destroyed) return;
	actor.lifecycleIntentGeneration += 1;
	actor.visualTransitionGeneration += 1;
	for (const visual of actor.visuals) yield* destroyPixiTileActorVisualFx(visual);
	actor.visuals.clear();
	actor.pendingVisual = null;
	actor.container.destroy({
		children: true,
	});
});
