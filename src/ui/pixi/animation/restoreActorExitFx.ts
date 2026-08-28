import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
export namespace restoreActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly durationMs?: number;
	}
}
export const restoreActorExitFx = Effect.fnUntraced(function* (props: restoreActorExitFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "restore-exit",
	});
});
