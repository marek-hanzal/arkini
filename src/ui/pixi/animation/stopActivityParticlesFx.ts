import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActivityParticlesFx } from "~/ui/pixi/animation/runActivityParticlesFx";
export namespace stopActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}
export const stopActivityParticlesFx = Effect.fnUntraced(function* (
	props: stopActivityParticlesFx.Props,
) {
	return yield* runActivityParticlesFx({
		...props,
		kind: "stop",
	});
});
