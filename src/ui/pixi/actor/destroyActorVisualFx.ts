import { Effect } from "effect";

import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { cancelVisualReadinessFx } from "~/ui/pixi/actor/cancelVisualReadinessFx";

/** Cancels one physical visual revision before destroying its private display tree exactly once. */
export const destroyActorVisualFx = Effect.fn("destroyActorVisualFx")(function* (
	visual: ActorVisual,
) {
	if (visual.container.destroyed) return;
	yield* cancelVisualReadinessFx(visual);
	visual.container.destroy({
		children: true,
	});
});
