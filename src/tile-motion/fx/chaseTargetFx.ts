import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator, PresentedPose } from "~/tile-rendering/service/ActorAnimator";
import type { AnimationCurve } from "~/tile-rendering/service/AnimationDriver";
import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";
import { createMotionPoseSamplerFx } from "~/tile-motion/fx/createMotionPoseSamplerFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export namespace chaseTargetFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly curve?: AnimationCurve;
		readonly delayMs?: number;
		readonly durationMs?: number;
		readonly fallbackTarget: ActorPose;
		readonly onPose?: (pose: PresentedPose) => void;
		readonly onSettled: () => void;
		readonly ownerKey: string;
		readonly readLiveTarget?: () => Required<PresentedPose> | null;
		readonly settleWithinTileRatio?: number;
		readonly shouldSettle?: () => boolean;
		readonly surface: MainSurface;
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
export const chaseTargetFx = Effect.fn("chaseTargetFx")(function* ({
	actor,
	animator,
	curve,
	delayMs = 0,
	durationMs,
	fallbackTarget,
	onPose,
	onSettled,
	ownerKey,
	readLiveTarget,
	settleWithinTileRatio,
	shouldSettle,
	surface,
	targetLocation,
}: chaseTargetFx.Props) {
	let settled = false;
	let cancelingForProximitySettlement = false;
	let proximitySettlementQueued = false;
	const settle = () => {
		if (settled) return;
		settled = true;
		onSettled();
	};
	const isInsideSettlementField = (pose: PresentedPose) => {
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
	const poseSampler = yield* createMotionPoseSamplerFx({
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
		durationMs:
			durationMs ??
			readTravelDurationMsFn({
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
				chaseTargetFx({
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
