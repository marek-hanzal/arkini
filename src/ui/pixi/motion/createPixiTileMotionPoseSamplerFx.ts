import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiActorPresentedPose } from "~/ui/pixi/animation/PixiActorAnimator";
import {
	createPixiRectangularRetargetablePoseSamplerFx,
	type PixiActorRectangularPose,
} from "~/ui/pixi/animation/createPixiRectangularRetargetablePoseSamplerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace createPixiTileMotionPoseSamplerFx {
	export interface Props {
		readonly actorBaseHeight: number;
		readonly actorBaseWidth: number;
		readonly from: PixiActorRectangularPose;
		readonly readLiveTarget?: () => PixiActorPresentedPose | null;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
		readonly targetFootprint?: Parameters<PixiMainSceneSurface["readLocationPoseFx"]>[1];
		readonly targetLocation: Parameters<PixiMainSceneSurface["readLocationPoseFx"]>[0];
	}

	export interface Result {
		readonly needsCompletionSettle: () => boolean;
		readonly readPose: (progress: number) => PixiActorPresentedPose;
	}
}

const samePose = (left: PixiActorRectangularPose, right: PixiActorRectangularPose) =>
	left.x === right.x &&
	left.y === right.y &&
	left.scaleX === right.scaleX &&
	left.scaleY === right.scaleY;

/**
 * Retargets travel from its live presentation toward the latest semantic destination.
 *
 * A geometry change first advances along the previous segment, then makes that exact presentation
 * the origin of the remaining segment. Repeated resize frames therefore keep moving instead of
 * continually restarting, while progress 1 always publishes the latest canonical destination.
 */
export const createPixiTileMotionPoseSamplerFx = Effect.fn("createPixiTileMotionPoseSamplerFx")(
	(props: createPixiTileMotionPoseSamplerFx.Props) =>
		Effect.gen(function* (): Effect.fn.Return<createPixiTileMotionPoseSamplerFx.Result> {
			let sampleProgress = 0;
			let completionRetargeted = false;
			const normalizeLivePose = (pose: PixiActorPresentedPose): PixiActorRectangularPose => ({
				scaleX: pose.scaleX ?? pose.scale ?? 1,
				scaleY: pose.scaleY ?? pose.scale ?? 1,
				x: pose.x,
				y: pose.y,
			});
			let previousTarget: PixiActorRectangularPose = {
				scaleX:
					(props.target.width ?? props.target.size) / Math.max(1, props.actorBaseWidth),
				scaleY:
					(props.target.height ?? props.target.size) / Math.max(1, props.actorBaseHeight),
				x: props.target.x,
				y: props.target.y,
			};
			const readCurrentTarget = () => {
				const liveTarget = props.readLiveTarget?.();
				if (liveTarget !== null && liveTarget !== undefined)
					return normalizeLivePose(liveTarget);
				const currentTarget =
					RendererRuntime.runSync(
						props.surface.readLocationPoseFx(
							props.targetLocation,
							props.targetFootprint,
						),
					) ?? props.target;
				return {
					scaleX:
						(currentTarget.width ?? currentTarget.size) /
						Math.max(1, props.actorBaseWidth),
					scaleY:
						(currentTarget.height ?? currentTarget.size) /
						Math.max(1, props.actorBaseHeight),
					x: currentTarget.x,
					y: currentTarget.y,
				};
			};
			const readPose = yield* createPixiRectangularRetargetablePoseSamplerFx({
				from: props.from,
				readTarget: () => {
					const nextTarget = readCurrentTarget();
					if (sampleProgress >= 1 && !samePose(previousTarget, nextTarget)) {
						completionRetargeted = true;
					}
					previousTarget = nextTarget;
					return nextTarget;
				},
			});
			return {
				needsCompletionSettle: () =>
					completionRetargeted || !samePose(previousTarget, readCurrentTarget()),
				readPose: (progress) => {
					sampleProgress = progress;
					const pose = readPose(progress);
					return pose.scaleX === pose.scaleY
						? {
								scale: pose.scaleX,
								x: pose.x,
								y: pose.y,
							}
						: pose;
				},
			};
		}),
);
