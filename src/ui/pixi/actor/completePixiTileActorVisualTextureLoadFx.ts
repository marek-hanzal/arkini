import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runPixiTileActorVisualReadinessFx } from "~/ui/pixi/actor/runPixiTileActorVisualReadinessFx";
export const completePixiTileActorVisualTextureLoadFx = Effect.fnUntraced(function* ({
	generation,
	visual,
}: {
	readonly generation: number;
	readonly visual: PixiTileActorVisual;
}) {
	return yield* runPixiTileActorVisualReadinessFx({
		generation,
		kind: "complete",
		visual,
	});
});
