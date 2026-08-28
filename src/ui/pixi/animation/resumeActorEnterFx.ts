import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace resumeActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}
export const resumeActorEnterFx = Effect.fnUntraced(function* (props: resumeActorEnterFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "resume-enter",
	});
});
