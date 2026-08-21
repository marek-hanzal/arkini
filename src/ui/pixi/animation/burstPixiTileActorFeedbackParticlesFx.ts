import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
export namespace burstPixiTileActorFeedbackParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly tint?: number;
	}
}
export const burstPixiTileActorFeedbackParticlesFx = Effect.fnUntraced(function* (
	props: burstPixiTileActorFeedbackParticlesFx.Props,
) {
	return yield* runPixiTileActorActivityParticlesFx({
		...props,
		kind: "feedback",
	});
});
