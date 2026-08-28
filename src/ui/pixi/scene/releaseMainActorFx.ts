import { Effect } from "effect";

import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import type { MainDragController } from "~/ui/pixi/drag/MainDragController";

export namespace releaseMainActorFx {
	export interface Props {
		readonly actorId: string;
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly drag: MainDragController;
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
