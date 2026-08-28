import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { burstPixiTileActorFeedbackParticlesFx } from "~/ui/pixi/animation/burstPixiTileActorFeedbackParticlesFx";
export namespace burstPixiTileActorAckParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly tint: number;
	}
}
export const burstPixiTileActorAckParticlesFx = Effect.fnUntraced(function* (
	props: burstPixiTileActorAckParticlesFx.Props,
) {
	return yield* burstPixiTileActorFeedbackParticlesFx(props);
});
