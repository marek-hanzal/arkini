import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActivityParticlesFx } from "~/ui/pixi/animation/runActivityParticlesFx";
export namespace startActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
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
