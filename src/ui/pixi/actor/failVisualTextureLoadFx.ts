import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const failVisualTextureLoadFx = Effect.fnUntraced(function* ({
	generation,
	visual,
}: {
	readonly generation: number;
	readonly visual: PixiTileActorVisual;
}) {
	return yield* runVisualReadinessFx({
		generation,
		kind: "fail",
		visual,
	});
});
