import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { burstPixiTileActorFeedbackParticlesFx } from "~/ui/pixi/animation/burstPixiTileActorFeedbackParticlesFx";

/** Bursts contact acknowledgement only while the canonical target actor still exists. */
export const flashPixiMotionTargetFx = Effect.fn("flashPixiMotionTargetFx")(function* ({
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
	yield* burstPixiTileActorFeedbackParticlesFx({
		actor: target,
		animator,
	});
});
