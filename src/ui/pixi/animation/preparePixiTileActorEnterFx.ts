import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorLifecycleFx } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
export namespace preparePixiTileActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}
export const preparePixiTileActorEnterFx = Effect.fnUntraced(function* (
	props: preparePixiTileActorEnterFx.Props,
) {
	return yield* runPixiTileActorLifecycleFx({
		...props,
		kind: "prepare-enter",
	});
});
