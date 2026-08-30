import { Effect } from "effect";

import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { burstFeedbackParticlesFx } from "~/tile-rendering/fx/burstFeedbackParticlesFx";

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
