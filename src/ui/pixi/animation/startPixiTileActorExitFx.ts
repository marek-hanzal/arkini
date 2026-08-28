import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorLifecycleFx } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
export namespace startPixiTileActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly durationMs?: number;
		readonly onCancel?: () => void;
		readonly onComplete?: () => void;
	}
}
export const startPixiTileActorExitFx = Effect.fnUntraced(function* (
	props: startPixiTileActorExitFx.Props,
) {
	return yield* runPixiTileActorLifecycleFx({
		...props,
		kind: "start-exit",
	});
});
