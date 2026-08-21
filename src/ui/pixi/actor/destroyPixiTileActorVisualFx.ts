import { Effect } from "effect";

import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { cancelPixiTileActorVisualReadinessFx } from "~/ui/pixi/actor/cancelPixiTileActorVisualReadinessFx";

/** Cancels one physical visual revision before destroying its private display tree exactly once. */
export const destroyPixiTileActorVisualFx = Effect.fn("destroyPixiTileActorVisualFx")(function* (
	visual: PixiTileActorVisual,
) {
	if (visual.container.destroyed) return;
	yield* cancelPixiTileActorVisualReadinessFx(visual);
	visual.container.destroy({
		children: true,
	});
});
