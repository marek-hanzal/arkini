import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorLifecycleFx } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
export namespace startPixiTileActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly delayMs?: number;
		readonly durationMs?: number;
	}
}
export const startPixiTileActorEnterFx = Effect.fnUntraced(function* (
	props: startPixiTileActorEnterFx.Props,
) {
	return yield* runPixiTileActorLifecycleFx({
		...props,
		kind: "start-enter",
	});
});
