import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileSpawnMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readTravelDurationMsFx } from "~/ui/pixi/animation/readTravelDurationMsFx";
import { startActorEnterFx } from "~/ui/pixi/animation/startActorEnterFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { createMagneticProjectorFx } from "~/ui/pixi/motion/createMagneticProjectorFx";
import { createMotionPoseSamplerFx } from "~/ui/pixi/motion/createMotionPoseSamplerFx";
import { chaseTargetFx } from "~/ui/pixi/motion/chaseTargetFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace runSpawnMotionFx {
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
export const runSpawnMotionFx = Effect.fn("runSpawnMotionFx")(function* ({
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
}: runSpawnMotionFx.Props) {
	const actor = actorStore.actors.get(cue.actorId);
	if (actor === undefined) {
		onComplete();
		return;
	}
	surface.transientActorLayer.addChild(actor.container);
	yield* animator.setFx({
		actor,
		channel: "pose",
		scale: origin.size / Math.max(1, actor.size),
		x: origin.x,
		y: origin.y,
	});
	yield* startActorEnterFx({
		actor,
		animator,
		delayMs,
	});
	const durationMs = yield* readTravelDurationMsFx({
		fromX: origin.x,
		fromY: origin.y,
		tileSize: target.size,
		toX: target.x,
		toY: target.y,
	});
	const poseSampler = yield* createMotionPoseSamplerFx({
		actorBaseSize: actor.size,
		from: {
			scale: actor.container.scale.x,
			x: actor.container.x,
			y: actor.container.y,
		},
		surface,
		target,
		targetLocation: cue.targetLocation,
	});
	const magneticProjector = yield* createMagneticProjectorFx({
		actor,
		attractedActorId: null,
		eligibleAttractionActorIds: new Set(),
		magneticField,
		surface,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		delayMs,
		durationMs,
		ownerKey: `motion:${cueKey}`,
		onCancel: magneticProjector.release,
		onComplete: () => {
			const settle = () => {
				magneticProjector.release();
				const currentTarget =
					RendererRuntime.runSync(surface.readLocationPoseFx(cue.targetLocation)) ??
					target;
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
				chaseTargetFx({
					actor,
					animator,
					fallbackTarget: target,
					onPose: magneticProjector.projectPose,
					onSettled: settle,
					ownerKey: `motion:${cueKey}`,
					surface,
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
