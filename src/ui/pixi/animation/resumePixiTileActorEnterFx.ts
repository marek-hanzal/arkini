import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorLifecycleFx } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
export namespace resumePixiTileActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}
export const resumePixiTileActorEnterFx = Effect.fnUntraced(function* (
	props: resumePixiTileActorEnterFx.Props,
) {
	return yield* runPixiTileActorLifecycleFx({
		...props,
		kind: "resume-enter",
	});
});
