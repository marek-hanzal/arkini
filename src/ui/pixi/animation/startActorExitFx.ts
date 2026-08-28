import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace startActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
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
