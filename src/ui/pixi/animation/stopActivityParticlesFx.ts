import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActivityParticlesFx } from "~/ui/pixi/animation/runActivityParticlesFx";
export namespace stopActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
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
