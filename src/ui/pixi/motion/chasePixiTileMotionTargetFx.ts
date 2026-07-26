import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimator,
	PixiActorPresentedPose,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace chasePixiTileMotionTargetFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly delayMs?: number;
		readonly fallbackTarget: PixiTileActorPose;
		readonly onPose?: (pose: PixiActorPresentedPose) => void;
		readonly onSettled: () => void;
		readonly ownerKey: string;
		readonly readLiveTarget: () => Required<PixiActorPresentedPose> | null;
		readonly surface: PixiMainSceneSurface;
		readonly targetLocation: TileActorItem["location"];
	}
}

const samePose = (
	left: Required<PixiActorPresentedPose>,
	right: Required<PixiActorPresentedPose>,
) => left.x === right.x && left.y === right.y && left.scale === right.scale;

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/**
 * Chases a moving semantic target through speed-bounded, distance-aware segments.
 *
 * Each segment snapshots its endpoint. A late or far target move therefore starts a fresh segment
 * from the payload's exact contact candidate instead of compressing displacement into the original
 * tween's remaining progress. Settlement occurs only when a completed segment still matches the
 * latest live target.
 */
export const chasePixiTileMotionTargetFx = Effect.fn("chasePixiTileMotionTargetFx")(function* ({
	actor,
	animator,
	delayMs = 0,
	fallbackTarget,
	onPose,
	onSettled,
	ownerKey,
	readLiveTarget,
	surface,
	targetLocation,
}: chasePixiTileMotionTargetFx.Props) {
	if (actor.container.destroyed) {
		onSettled();
		return;
	}
	const semanticTarget = (yield* surface.readLocationPoseFx(targetLocation)) ?? fallbackTarget;
	const from = {
		scale: actor.container.scale.x,
		x: actor.container.x,
		y: actor.container.y,
	};
	const target = readLiveTarget() ?? {
		scale: semanticTarget.size / Math.max(1, actor.size),
		x: semanticTarget.x,
		y: semanticTarget.y,
	};
	if (samePose(from, target)) {
		onSettled();
		return;
	}
	yield* animator.animateFx({
		actor,
		channel: "pose",
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
			RendererRuntime.runSync(
				chasePixiTileMotionTargetFx({
					actor,
					animator,
					fallbackTarget: semanticTarget,
					onPose,
					onSettled,
					ownerKey,
					readLiveTarget,
					surface,
					targetLocation,
				}),
			);
		},
		readPose: (progress) => {
			const pose = {
				scale: mix(from.scale, target.scale, progress),
				x: mix(from.x, target.x, progress),
				y: mix(from.y, target.y, progress),
			};
			onPose?.(pose);
			return pose;
		},
	});
});
