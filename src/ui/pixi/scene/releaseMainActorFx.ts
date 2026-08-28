import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";

export namespace releaseMainActorFx {
	export interface Props {
		readonly actorId: string;
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly drag: PixiMainSceneDragController;
	}
}

/** Releases every retained owner claim before an actor exits or is destroyed. */
export const releaseMainActorFx = Effect.fn("releaseMainActorFx")(function* ({
	actorId,
	actorStore,
	animator,
	drag,
}: releaseMainActorFx.Props) {
	const actor = actorStore.actors.get(actorId);
	if (actor === undefined) return null;
	yield* drag.detachActorFx(actor);
	yield* actorStore.releaseActorFx(actorId);
	yield* animator.cancelActorFx(actor);
	actor.visualTransitionGeneration += 1;
	return actor;
});
