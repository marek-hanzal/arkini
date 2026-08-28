import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyActorVisualFx } from "~/ui/pixi/actor/destroyActorVisualFx";

/** Cancels every visual revision before physically destroying one actor instance exactly once. */
export const destroyTileActorFx = Effect.fn("destroyTileActorFx")(function* (actor: PixiTileActor) {
	if (actor.container.destroyed) return;
	actor.lifecycleIntentGeneration += 1;
	actor.visualTransitionGeneration += 1;
	for (const visual of actor.visuals) yield* destroyActorVisualFx(visual);
	actor.visuals.clear();
	actor.pendingVisual = null;
	actor.container.destroy({
		children: true,
	});
});
