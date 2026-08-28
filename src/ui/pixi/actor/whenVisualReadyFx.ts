import { Effect } from "effect";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
export const whenVisualReadyFx = Effect.fnUntraced(function* ({
	onCancel,
	onReady,
	visual,
}: {
	readonly onCancel?: () => void;
	readonly onReady: () => void;
	readonly visual: ActorVisual;
}) {
	return yield* runVisualReadinessFx({
		kind: "when-ready",
		onCancel,
		onReady,
		visual,
	});
});
