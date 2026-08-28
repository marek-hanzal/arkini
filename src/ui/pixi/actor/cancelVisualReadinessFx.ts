import { Effect } from "effect";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const cancelVisualReadinessFx = Effect.fnUntraced(function* (visual: ActorVisual) {
	return yield* runVisualReadinessFx({
		kind: "cancel",
		visual,
	});
});
