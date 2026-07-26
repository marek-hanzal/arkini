import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";

export namespace releasePixiMainSceneActorFx {
	export interface Props {
		readonly actorId: string;
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly drag: PixiMainSceneDragController;
	}
}

/** Releases every retained owner claim before an actor exits or is destroyed. */
export const releasePixiMainSceneActorFx = Effect.fn("releasePixiMainSceneActorFx")(function* ({
	actorId,
	actorStore,
	animator,
	drag,
}: releasePixiMainSceneActorFx.Props) {
	const actor = actorStore.actors.get(actorId);
	if (actor === undefined) return null;
	yield* drag.detachActorFx(actor);
	yield* actorStore.releaseActorFx(actorId);
	yield* animator.cancelActorFx(actor);
	actor.lifecycleIntentGeneration += 1;
	actor.lifecycleTargetAlpha = 0;
	actor.lifecycleFadeStarted = true;
	actor.visualTransitionGeneration += 1;
	return actor;
});
