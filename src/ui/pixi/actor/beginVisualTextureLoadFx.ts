import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const beginVisualTextureLoadFx = Effect.fnUntraced(function* (visual: PixiTileActorVisual) {
	return yield* runVisualReadinessFx({
		kind: "begin",
		visual,
	});
});
