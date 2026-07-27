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
	shouldSettle,
	surface,
	targetLocation,
}: chasePixiTileMotionTargetFx.Props) {
	if (actor.container.destroyed || shouldSettle?.()) {
		onSettled();
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
		onSettled();
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
		onComplete: () => {
			if (shouldSettle?.() || !poseSampler.needsCompletionSettle()) {
				onSettled();
				return;
			}
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
					shouldSettle,
					surface,
					targetLocation,
				}),
			);
		},
		readPose: (progress) => {
			const pose = poseSampler.readPose(progress);
			onPose?.(pose);
			return pose;
		},
	});
});
