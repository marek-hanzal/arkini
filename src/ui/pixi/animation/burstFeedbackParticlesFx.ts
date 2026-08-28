import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActivityParticlesFx } from "~/ui/pixi/animation/runActivityParticlesFx";
export namespace burstFeedbackParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly tint?: number;
	}
}
export const burstFeedbackParticlesFx = Effect.fnUntraced(function* (
	props: burstFeedbackParticlesFx.Props,
) {
	return yield* runActivityParticlesFx({
		...props,
		kind: "feedback",
	});
});
