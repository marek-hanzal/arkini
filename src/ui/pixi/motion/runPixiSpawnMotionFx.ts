import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileSpawnMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { createPixiTileMotionTravelFx } from "~/ui/pixi/motion/createPixiTileMotionTravelFx";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace runPixiSpawnMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly cue: TileSpawnMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: PixiTileMagneticField;
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
	magneticField,
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
	surface.transientActorLayer.addChild(actor.container);
	yield* animator.setFx({
		actor,
		channel: "pose",
		scaleX: (origin.width || origin.size) / Math.max(1, actor.width || actor.size),
		scaleY: (origin.height || origin.size) / Math.max(1, actor.height || actor.size),
		x: origin.x,
		y: origin.y,
	});
	yield* startPixiTileActorFadeInFx({
		actor,
		animator,
		delayMs,
	});
	const durationMs = yield* readPixiTileTravelDurationMsFx({
		fromX: origin.x,
		fromY: origin.y,
		tileSize: target.size,
		toX: target.x,
		toY: target.y,
	});
	const { magneticProjector, poseSampler } = yield* createPixiTileMotionTravelFx({
		actor,
		magneticField,
		surface,
		target,
		targetFootprint: cue.targetFootprint,
		targetLocation: cue.targetLocation,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		delayMs,
		durationMs,
		ownerKey: `motion:${cueKey}`,
		onComplete: () => {
			const settle = () => {
				magneticProjector.release();
				const currentTarget =
					RendererRuntime.runSync(
						surface.readLocationPoseFx(cue.targetLocation, cue.targetFootprint),
					) ?? target;
				if (!actor.container.destroyed) {
					currentTarget.layer.addChild(actor.container);
				}
				onComplete();
			};
			if (!poseSampler.needsCompletionSettle()) {
				settle();
				return;
			}
			RendererRuntime.runSync(
				chasePixiTileMotionTargetFx({
					actor,
					animator,
					fallbackTarget: target,
					onPose: magneticProjector.projectPose,
					onSettled: settle,
					ownerKey: `motion:${cueKey}`,
					surface,
					targetFootprint: cue.targetFootprint,
					targetLocation: cue.targetLocation,
				}),
			);
		},
		readPose: (progress) => {
			const pose = poseSampler.readPose(progress);
			magneticProjector.projectPose(pose);
			return pose;
		},
	});
});
