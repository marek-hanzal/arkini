import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runActivityParticlesFx } from "~/ui/pixi/animation/runActivityParticlesFx";
export namespace burstFeedbackParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
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
