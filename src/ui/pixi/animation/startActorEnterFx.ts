import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace startActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
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
