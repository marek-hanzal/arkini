import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActivityParticlesFx } from "~/ui/pixi/animation/runActivityParticlesFx";
export namespace startActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly rampIn?: boolean;
	}
}
export const startActivityParticlesFx = Effect.fnUntraced(function* (
	props: startActivityParticlesFx.Props,
) {
	return yield* runActivityParticlesFx({
		...props,
		kind: "start",
	});
});
