import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileRelocationMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiDragSettleDurationMsFx } from "~/ui/pixi/drag/readPixiDragSettleDurationMsFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { createPixiTileMotionPoseSamplerFx } from "~/ui/pixi/motion/createPixiTileMotionPoseSamplerFx";
import { createPixiTileMotionTravelFx } from "~/ui/pixi/motion/createPixiTileMotionTravelFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace runPixiRelocationMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly cue: TileRelocationMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: PixiTileMagneticField;
		readonly onComplete: () => void;
		readonly onLegSettled: (actorId: string) => void;
		readonly onLegStarted: (actorId: string) => void;
		readonly origin: PixiTileActorPose;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
	}
}

/** Animates one exact committed identity relocation; absent actors reconcile canonically. */
export const runPixiRelocationMotionFx = Effect.fn("runPixiRelocationMotionFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onComplete,
	onLegSettled,
	onLegStarted,
	origin,
	surface,
	target,
}: runPixiRelocationMotionFx.Props) {
	const actor = actorStore.actors.get(cue.actorId);
	if (actor === undefined || actor.container.destroyed) {
		onComplete();
		return;
	}
	surface.transientActorLayer.addChild(actor.container);
	yield* animator.setFx({
		actor,
		channel: "pose",
		scaleX: origin.width / Math.max(1, actor.width),
		scaleY: origin.height / Math.max(1, actor.height),
		x: origin.x,
		y: origin.y,
	});
	const durationMs = yield* readPixiDragSettleDurationMsFx({
		fromX: actor.container.x,
		fromY: actor.container.y,
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
	let settled = false;
	const settle = () => {
		if (settled) return;
		settled = true;
		magneticProjector.release();
		if (!actor.container.destroyed) {
			const canonical = actorStore.canonicalItems.get(actor.item.id);
			const currentTarget =
				canonical === undefined
					? null
					: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
			(currentTarget ?? target).layer.addChild(actor.container);
		}
		onLegSettled(actor.item.id);
		onComplete();
	};
	const continueToLiveTarget = () => {
		if (actor.container.destroyed) {
			settle();
			return;
		}
		const liveTarget = RendererRuntime.runSync(
			surface.readLocationPoseFx(cue.targetLocation, cue.targetFootprint),
		);
		if (liveTarget === null) {
			settle();
			return;
		}
		const from = {
			scaleX: actor.container.scale.x,
			scaleY: actor.container.scale.y,
			x: actor.container.x,
			y: actor.container.y,
		};
		const targetScaleX = liveTarget.width / Math.max(1, actor.width);
		const targetScaleY = liveTarget.height / Math.max(1, actor.height);
		if (
			from.x === liveTarget.x &&
			from.y === liveTarget.y &&
			from.scaleX === targetScaleX &&
			from.scaleY === targetScaleY
		) {
			settle();
			return;
		}
		const continuationSampler = RendererRuntime.runSync(
			createPixiTileMotionPoseSamplerFx({
				actorBaseHeight: actor.height,
				actorBaseWidth: actor.width,
				from,
				surface,
				target: liveTarget,
				targetFootprint: cue.targetFootprint,
				targetLocation: cue.targetLocation,
			}),
		);
		RendererRuntime.runSync(
			animator.animateFx({
				actor,
				channel: "pose",
				curve: {
					bounce: 0.14,
					kind: "spring",
				},
				durationMs: RendererRuntime.runSync(
					readPixiDragSettleDurationMsFx({
						fromX: from.x,
						fromY: from.y,
						tileSize: Math.max(liveTarget.width, liveTarget.height),
						toX: liveTarget.x,
						toY: liveTarget.y,
					}),
				),
				ownerKey: `motion:${cueKey}:${actor.item.id}`,
				onComplete: () => {
					if (continuationSampler.needsCompletionSettle()) {
						continueToLiveTarget();
						return;
					}
					settle();
				},
				readPose: (progress) => {
					const pose = continuationSampler.readPose(progress);
					magneticProjector.projectPose(pose);
					return pose;
				},
			}),
		);
	};
	onLegStarted(actor.item.id);
	yield* animator.animateFx({
		actor,
		channel: "pose",
		curve: {
			bounce: 0.14,
			kind: "spring",
		},
		delayMs,
		durationMs,
		ownerKey: `motion:${cueKey}:${actor.item.id}`,
		onComplete: () => {
			if (!poseSampler.needsCompletionSettle()) {
				settle();
				return;
			}
			continueToLiveTarget();
		},
		readPose: (progress) => {
			const pose = poseSampler.readPose(progress);
			magneticProjector.projectPose(pose);
			return pose;
		},
	});
});
