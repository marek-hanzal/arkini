import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import { readPixiReplacementAlphaAnimationKey } from "~/ui/pixi/scene/readPixiReplacementAlphaAnimationKey";

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
	yield* actorStore.deleteActorFx(actorId);
	yield* animator.cancelFx(actorId);
	yield* animator.cancelFx(`running:${actorId}`);
	yield* animator.cancelFx(readPixiReplacementAlphaAnimationKey(actorId));
	return actor;
});
