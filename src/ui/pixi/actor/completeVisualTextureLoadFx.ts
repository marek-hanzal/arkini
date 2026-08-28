import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const completeVisualTextureLoadFx = Effect.fnUntraced(function* ({
	generation,
	visual,
}: {
	readonly generation: number;
	readonly visual: PixiTileActorVisual;
}) {
	return yield* runVisualReadinessFx({
		generation,
		kind: "complete",
		visual,
	});
});
