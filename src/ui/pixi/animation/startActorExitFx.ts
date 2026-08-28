import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace startActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly durationMs?: number;
		readonly onCancel?: () => void;
		readonly onComplete?: () => void;
	}
}
export const startActorExitFx = Effect.fnUntraced(function* (props: startActorExitFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "start-exit",
	});
});
