import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimator,
	PixiActorPresentedPose,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import { createPixiTileMotionPoseSamplerFx } from "~/ui/pixi/motion/createPixiTileMotionPoseSamplerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace settlePixiTileMotionActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly fallbackTarget: PixiTileActorPose;
		readonly onPose?: (pose: PixiActorPresentedPose) => void;
		readonly onSettled: () => void;
		readonly ownerKey: string;
		readonly readLiveTarget?: () => Required<PixiActorPresentedPose> | null;
		readonly surface: PixiMainSceneSurface;
		readonly targetLocation: TileActorItem["location"];
	}
}

/**
 * Continues a semantic travel segment when geometry changes on its exact completion frame.
 *
 * Each continuation starts at the surviving physical presentation. A second final-frame resize
 * schedules another segment, so no path needs a hard endpoint write or a one-frame teleport.
 */
export const settlePixiTileMotionActorFx = Effect.fn("settlePixiTileMotionActorFx")(function* ({
	actor,
	animator,
	fallbackTarget,
	onPose,
	onSettled,
	ownerKey,
	readLiveTarget,
	surface,
	targetLocation,
}: settlePixiTileMotionActorFx.Props) {
	if (actor.container.destroyed) {
		onSettled();
		return;
	}
	const semanticTarget = (yield* surface.readLocationPoseFx(targetLocation)) ?? fallbackTarget;
	const target = readLiveTarget?.() ?? {
		scale: semanticTarget.size / Math.max(1, actor.size),
		x: semanticTarget.x,
		y: semanticTarget.y,
	};
	if (
		target.x === actor.container.x &&
		target.y === actor.container.y &&
		actor.container.scale.x === target.scale
	) {
		onSettled();
		return;
	}
	const poseSampler = yield* createPixiTileMotionPoseSamplerFx({
		actorBaseSize: actor.size,
		from: {
			scale: actor.container.scale.x,
			x: actor.container.x,
			y: actor.container.y,
		},
		readLiveTarget,
		surface,
		target: semanticTarget,
		targetLocation,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		durationMs: yield* readPixiTileTravelDurationMsFx({
			fromX: actor.container.x,
			fromY: actor.container.y,
			tileSize: semanticTarget.size,
			toX: target.x,
			toY: target.y,
		}),
		ownerKey,
		onComplete: () => {
			if (!poseSampler.needsCompletionSettle()) {
				onSettled();
				return;
			}
			RendererRuntime.runSync(
				settlePixiTileMotionActorFx({
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
			const pose = poseSampler.readPose(progress);
			onPose?.(pose);
			return pose;
		},
	});
});
