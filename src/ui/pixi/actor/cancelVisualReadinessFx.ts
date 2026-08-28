import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const cancelVisualReadinessFx = Effect.fnUntraced(function* (visual: PixiTileActorVisual) {
	return yield* runVisualReadinessFx({
		kind: "cancel",
		visual,
	});
});
