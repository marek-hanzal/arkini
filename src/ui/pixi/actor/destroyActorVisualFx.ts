import { Effect } from "effect";

import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { cancelVisualReadinessFx } from "~/ui/pixi/actor/cancelVisualReadinessFx";

/** Cancels one physical visual revision before destroying its private display tree exactly once. */
export const destroyActorVisualFx = Effect.fn("destroyActorVisualFx")(function* (
	visual: PixiTileActorVisual,
) {
	if (visual.container.destroyed) return;
	yield* cancelVisualReadinessFx(visual);
	visual.container.destroy({
		children: true,
	});
});
