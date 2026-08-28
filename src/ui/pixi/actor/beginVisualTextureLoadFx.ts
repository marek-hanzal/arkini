import { Effect } from "effect";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const beginVisualTextureLoadFx = Effect.fnUntraced(function* (visual: ActorVisual) {
	return yield* runVisualReadinessFx({
		kind: "begin",
		visual,
	});
});
