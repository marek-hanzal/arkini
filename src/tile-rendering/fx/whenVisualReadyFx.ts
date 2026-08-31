import { Effect } from "effect";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
export const whenVisualReadyFx = Effect.fnUntraced(function* ({
	onCancelFn,
	onReadyFn,
	visual,
}: {
	readonly onCancelFn?: () => void;
	readonly onReadyFn: () => void;
	readonly visual: ActorVisual;
}) {
	return yield* runVisualReadinessFx({
		kind: "when-ready",
		onCancelFn,
		onReadyFn,
		visual,
	});
});
