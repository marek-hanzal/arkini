import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorLifecycleFx } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
export namespace restorePixiTileActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly durationMs?: number;
	}
}
export const restorePixiTileActorExitFx = Effect.fnUntraced(function* (
	props: restorePixiTileActorExitFx.Props,
) {
	return yield* runPixiTileActorLifecycleFx({
		...props,
		kind: "restore-exit",
	});
});
