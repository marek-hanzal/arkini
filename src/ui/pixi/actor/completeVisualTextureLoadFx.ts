import { Effect } from "effect";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const completeVisualTextureLoadFx = Effect.fnUntraced(function* ({
	generation,
	visual,
}: {
	readonly generation: number;
	readonly visual: ActorVisual;
}) {
	return yield* runVisualReadinessFx({
		generation,
		kind: "complete",
		visual,
	});
});
