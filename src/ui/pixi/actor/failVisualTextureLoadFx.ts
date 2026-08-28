import { Effect } from "effect";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const failVisualTextureLoadFx = Effect.fnUntraced(function* ({
	generation,
	visual,
}: {
	readonly generation: number;
	readonly visual: ActorVisual;
}) {
	return yield* runVisualReadinessFx({
		generation,
		kind: "fail",
		visual,
	});
});
