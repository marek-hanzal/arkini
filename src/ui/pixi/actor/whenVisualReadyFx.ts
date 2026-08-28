import { Effect } from "effect";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const whenVisualReadyFx = Effect.fnUntraced(function* ({
	onCancel,
	onReady,
	visual,
}: {
	readonly onCancel?: () => void;
	readonly onReady: () => void;
	readonly visual: PixiTileActorVisual;
}) {
	return yield* runVisualReadinessFx({
		kind: "when-ready",
		onCancel,
		onReady,
		visual,
	});
});
