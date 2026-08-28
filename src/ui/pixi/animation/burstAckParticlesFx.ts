import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";
export namespace burstAckParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly tint: number;
	}
}
export const burstAckParticlesFx = Effect.fnUntraced(function* (props: burstAckParticlesFx.Props) {
	return yield* burstFeedbackParticlesFx(props);
});
