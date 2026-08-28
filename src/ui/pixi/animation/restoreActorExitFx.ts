import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace restoreActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly durationMs?: number;
	}
}
export const restoreActorExitFx = Effect.fnUntraced(function* (props: restoreActorExitFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "restore-exit",
	});
});
