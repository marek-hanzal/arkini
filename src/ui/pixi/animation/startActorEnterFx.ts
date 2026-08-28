import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace startActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly delayMs?: number;
		readonly durationMs?: number;
	}
}
export const startActorEnterFx = Effect.fnUntraced(function* (props: startActorEnterFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "start-enter",
	});
});
