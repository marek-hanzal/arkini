import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiActorPresentedPose } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createPixiRetargetablePoseSamplerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace createPixiTileMotionPoseSamplerFx {
	export interface Props {
		readonly actorBaseSize: number;
		readonly from: Required<PixiActorPresentedPose>;
		readonly readLiveTarget?: () => Required<PixiActorPresentedPose> | null;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
		readonly targetLocation: Parameters<PixiMainSceneSurface["readLocationPoseFx"]>[0];
	}

	export interface Result {
		readonly needsCompletionSettle: () => boolean;
		readonly readPose: (progress: number) => PixiActorPresentedPose;
	}
}

const samePose = (
	left: Required<PixiActorPresentedPose>,
	right: Required<PixiActorPresentedPose>,
) => left.x === right.x && left.y === right.y && left.scale === right.scale;

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
			let previousTarget: Required<PixiActorPresentedPose> = {
				scale: props.target.size / Math.max(1, props.actorBaseSize),
				x: props.target.x,
				y: props.target.y,
			};
			const readPose = yield* createPixiRetargetablePoseSamplerFx({
				from: props.from,
				readTarget: () => {
					const liveTarget = props.readLiveTarget?.();
					const nextTarget =
						liveTarget ??
						(() => {
							const currentTarget =
								RendererRuntime.runSync(
									props.surface.readLocationPoseFx(props.targetLocation),
								) ?? props.target;
							return {
								scale: currentTarget.size / Math.max(1, props.actorBaseSize),
								x: currentTarget.x,
								y: currentTarget.y,
							};
						})();
					if (sampleProgress >= 1 && !samePose(previousTarget, nextTarget)) {
						completionRetargeted = true;
					}
					previousTarget = nextTarget;
					return nextTarget;
				},
			});
			return {
				needsCompletionSettle: () => completionRetargeted,
				readPose: (progress) => {
					sampleProgress = progress;
					return readPose(progress);
				},
			};
		}),
);
