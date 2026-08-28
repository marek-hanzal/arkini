import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace prepareActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
	}
}
export const prepareActorEnterFx = Effect.fnUntraced(function* (props: prepareActorEnterFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "prepare-enter",
	});
});
