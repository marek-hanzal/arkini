import { Effect } from "effect";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { runActivityParticlesFx } from "~/tile-rendering/fx/runActivityParticlesFx";
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
