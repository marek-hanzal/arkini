import { Effect } from "effect";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
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
