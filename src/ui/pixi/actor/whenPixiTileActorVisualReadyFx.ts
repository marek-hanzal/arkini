import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runPixiTileActorVisualReadinessFx } from "~/ui/pixi/actor/runPixiTileActorVisualReadinessFx";
export const whenPixiTileActorVisualReadyFx = Effect.fnUntraced(function* ({
	onCancel,
	onReady,
	visual,
}: {
	readonly onCancel?: () => void;
	readonly onReady: () => void;
	readonly visual: PixiTileActorVisual;
}) {
	return yield* runPixiTileActorVisualReadinessFx({
		kind: "when-ready",
		onCancel,
		onReady,
		visual,
	});
});
