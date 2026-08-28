import { Effect } from "effect";

import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";

/** Bursts contact acknowledgement only while the canonical target actor still exists. */
export const flashMotionTargetFx = Effect.fn("flashMotionTargetFx")(function* ({
	actorStore,
	animator,
	targetActorId,
}: {
	readonly actorStore: Pick<MainActorStore, "actors">;
	readonly animator: ActorAnimator;
	readonly targetActorId: string;
}) {
	const target = actorStore.actors.get(targetActorId);
	if (target === undefined) return;
	yield* burstFeedbackParticlesFx({
		actor: target,
		animator,
	});
});
