import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileSpawnMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace runPixiSpawnMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly cue: TileSpawnMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly onComplete: () => void;
		readonly origin: PixiTileActorPose;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
	}
}

/** Starts one canonical spawn actor from its resolved origin into the target surface pose. */
export const runPixiSpawnMotionFx = Effect.fn("runPixiSpawnMotionFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	delayMs,
	onComplete,
	origin,
	surface,
	target,
}: runPixiSpawnMotionFx.Props) {
	const actor = actorStore.actors.get(cue.actorId);
	if (actor === undefined) {
		onComplete();
		return;
	}
	yield* animator.cancelFx(actor.item.id);
	surface.transientActorLayer.addChild(actor.container);
	actor.container.x = origin.x;
	actor.container.y = origin.y;
	const durationMs = yield* readPixiTileTravelDurationMsFx({
		fromX: origin.x,
		fromY: origin.y,
		tileSize: target.size,
		toX: target.x,
		toY: target.y,
	});
	yield* animator.animateFx({
		actor,
		animationKey: `motion:${cueKey}`,
		delayMs,
		durationMs,
		onComplete: () => {
			const currentTarget =
				RendererRuntime.runSync(surface.readLocationPoseFx(cue.targetLocation)) ?? target;
			if (!actor.container.destroyed) {
				currentTarget.layer.addChild(actor.container);
				actor.container.x = currentTarget.x;
				actor.container.y = currentTarget.y;
			}
			onComplete();
		},
		toAlpha: 1,
		toX: target.x,
		toY: target.y,
	});
});
