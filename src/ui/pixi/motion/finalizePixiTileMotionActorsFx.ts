import { Effect } from "effect";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace finalizePixiTileMotionActorsFx {
	export interface Props {
		readonly actorIds: ReadonlySet<string>;
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly stillClaimedActorIds: ReadonlySet<string>;
		readonly surface: PixiMainSceneSurface;
	}
}

/** Reattaches or destroys actors released by one completed cue after lane settlement. */
export const finalizePixiTileMotionActorsFx = Effect.fn("finalizePixiTileMotionActorsFx")(
	function* ({
		actorIds,
		actorStore,
		animator,
		stillClaimedActorIds,
		surface,
	}: finalizePixiTileMotionActorsFx.Props) {
		for (const actorId of actorIds) {
			if (stillClaimedActorIds.has(actorId)) continue;
			const actor = actorStore.actors.get(actorId);
			if (actor === undefined) continue;
			if (actor.container.destroyed) {
				yield* actorStore.deleteActorFx(actorId);
				continue;
			}
			const canonical = actorStore.canonicalItems.get(actorId);
			const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
			if (canonical === undefined || pose === null) {
				yield* actorStore.deleteActorFx(actorId);
				yield* animator.cancelFx(actorId);
				yield* destroyPixiTileActorFx(actor);
				continue;
			}
			actor.item = canonical;
			pose.layer.addChild(actor.container);
			actor.container.x = pose.x;
			actor.container.y = pose.y;
			actor.container.alpha = 1;
			actor.container.scale.set(1);
		}
	},
);
