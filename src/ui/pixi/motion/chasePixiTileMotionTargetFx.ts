import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimator,
	PixiActorPresentedPose,
} from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiAnimationCurve } from "~/ui/pixi/animation/PixiAnimationDriver";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import { createPixiTileMotionPoseSamplerFx } from "~/ui/pixi/motion/createPixiTileMotionPoseSamplerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace chasePixiTileMotionTargetFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly curve?: PixiAnimationCurve;
		readonly delayMs?: number;
		readonly fallbackTarget: PixiTileActorPose;
		readonly onPose?: (pose: PixiActorPresentedPose) => void;
		readonly onSettled: () => void;
		readonly ownerKey: string;
		readonly readLiveTarget?: () => Required<PixiActorPresentedPose> | null;
		readonly settleWithinTileRatio?: number;
		readonly shouldSettle?: () => boolean;
		readonly surface: PixiMainSceneSurface;
		readonly targetLocation: TileActorItem["location"];
	}
}

/**
 * Chases a moving semantic target through one continuous, retargetable presentation.
 *
 * Target movement rebases from the exact presented frame instead of finishing at a stale endpoint
 * and starting another visible leg. Only a final-frame retarget requires a continuation. A caller
 * may end the presentation when its canonical receiver leaves this scene, preventing fallback
 * travel toward a location the receiver no longer owns.
 */
export const chasePixiTileMotionTargetFx = Effect.fn("chasePixiTileMotionTargetFx")(function* ({
	actor,
	animator,
	curve,
	delayMs = 0,
	fallbackTarget,
	onPose,
	onSettled,
	ownerKey,
	readLiveTarget,
	settleWithinTileRatio,
	shouldSettle,
	surface,
	targetLocation,
}: chasePixiTileMotionTargetFx.Props) {
	let settled = false;
	let cancelingForProximitySettlement = false;
	let proximitySettlementQueued = false;
	const settle = () => {
		if (settled) return;
		settled = true;
		onSettled();
	};
	const isInsideSettlementField = (pose: PixiActorPresentedPose) => {
		const liveTarget = readLiveTarget?.();
		return (
			settleWithinTileRatio !== undefined &&
			liveTarget !== null &&
			liveTarget !== undefined &&
			Math.hypot(pose.x - liveTarget.x, pose.y - liveTarget.y) <=
				Math.max(1, actor.size * (pose.scale ?? actor.container.scale.x)) *
					settleWithinTileRatio
		);
	};
	if (actor.container.destroyed || shouldSettle?.()) {
		settle();
		return;
	}
	const semanticTarget = (yield* surface.readLocationPoseFx(targetLocation)) ?? fallbackTarget;
	const from = {
		scale: actor.container.scale.x,
		x: actor.container.x,
		y: actor.container.y,
	};
	const target = readLiveTarget?.() ?? {
		scale: semanticTarget.size / Math.max(1, actor.size),
		x: semanticTarget.x,
		y: semanticTarget.y,
	};
	if (from.x === target.x && from.y === target.y && from.scale === target.scale) {
		settle();
		return;
	}
	const poseSampler = yield* createPixiTileMotionPoseSamplerFx({
		actorBaseSize: actor.size,
		from,
		readLiveTarget,
		surface,
		target: semanticTarget,
		targetLocation,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		curve,
		delayMs,
		durationMs: yield* readPixiTileTravelDurationMsFx({
			fromX: from.x,
			fromY: from.y,
			tileSize: Math.max(1, target.scale * actor.size),
			toX: target.x,
			toY: target.y,
		}),
		ownerKey,
		onCancel: () => {
			if (!cancelingForProximitySettlement) settled = true;
		},
		onComplete: () => {
			if (shouldSettle?.() || !poseSampler.needsCompletionSettle()) {
				settle();
				return;
			}
			settled = true;
			RendererRuntime.runSync(
				chasePixiTileMotionTargetFx({
					actor,
					animator,
					curve,
					fallbackTarget: semanticTarget,
					onPose,
					onSettled,
					ownerKey,
					readLiveTarget,
					settleWithinTileRatio,
					shouldSettle,
					surface,
					targetLocation,
				}),
			);
		},
		readPose: (progress) => {
			const pose = poseSampler.readPose(progress);
			onPose?.(pose);
			if (progress < 1 && !proximitySettlementQueued && isInsideSettlementField(pose)) {
				proximitySettlementQueued = true;
				// The animator applies this returned pose after `readPose`; settle from the next
				// microtask so contact observes the published frame and never destroys mid-write.
				queueMicrotask(() => {
					proximitySettlementQueued = false;
					if (settled || actor.container.destroyed || shouldSettle?.()) return;
					if (
						!isInsideSettlementField({
							scale: actor.container.scale.x,
							x: actor.container.x,
							y: actor.container.y,
						})
					) {
						return;
					}
					const contactPose = readLiveTarget?.();
					if (contactPose === null || contactPose === undefined) return;
					cancelingForProximitySettlement = true;
					try {
						RendererRuntime.runSync(animator.cancelChannelFx(actor, "pose"));
						RendererRuntime.runSync(
							animator.setFx({
								actor,
								channel: "pose",
								scale: contactPose.scale,
								x: contactPose.x,
								y: contactPose.y,
							}),
						);
					} finally {
						cancelingForProximitySettlement = false;
					}
					settle();
				});
			}
			return pose;
		},
	});
});
