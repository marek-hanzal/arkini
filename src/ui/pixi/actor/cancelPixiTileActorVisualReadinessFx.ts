import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runPixiTileActorVisualReadinessFx } from "~/ui/pixi/actor/runPixiTileActorVisualReadinessFx";
export const cancelPixiTileActorVisualReadinessFx = Effect.fnUntraced(function* (
	visual: PixiTileActorVisual,
) {
	return yield* runPixiTileActorVisualReadinessFx({
		kind: "cancel",
		visual,
	});
});
