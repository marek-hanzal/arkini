import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";

/** Bursts contact acknowledgement only while the canonical target actor still exists. */
export const flashMotionTargetFx = Effect.fn("flashMotionTargetFx")(function* ({
	actorStore,
	animator,
	targetActorId,
}: {
	readonly actorStore: Pick<PixiMainSceneActorStore, "actors">;
	readonly animator: PixiActorAnimator;
	readonly targetActorId: string;
}) {
	const target = actorStore.actors.get(targetActorId);
	if (target === undefined) return;
	yield* burstFeedbackParticlesFx({
		actor: target,
		animator,
	});
});
