import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace resumeActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
	}
}
export const resumeActorEnterFx = Effect.fnUntraced(function* (props: resumeActorEnterFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "resume-enter",
	});
});
