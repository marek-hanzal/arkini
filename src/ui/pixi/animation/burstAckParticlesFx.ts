import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";
export namespace burstAckParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly tint: number;
	}
}
export const burstAckParticlesFx = Effect.fnUntraced(function* (props: burstAckParticlesFx.Props) {
	return yield* burstFeedbackParticlesFx(props);
});
