import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PresentedPose } from "~/tile-rendering/service/ActorAnimator";
import { createRetargetablePoseSamplerFx } from "~/tile-rendering/fx/createRetargetablePoseSamplerFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";

interface CreateMotionPoseSamplerProps {
	readonly actorBaseSize: number;
	readonly from: Required<PresentedPose>;
	readonly readLiveTargetFn?: () => Required<PresentedPose> | null;
	readonly surface: MainSurface;
	readonly target: ActorPose;
	readonly targetLocation: Parameters<MainSurface["readLocationPoseFx"]>[0];
}

interface MotionPoseSampler {
	readonly needsCompletionSettleFn: () => boolean;
	readonly readPoseFn: (progress: number) => PresentedPose;
}

const samePoseFn = (left: Required<PresentedPose>, right: Required<PresentedPose>) =>
	left.x === right.x && left.y === right.y && left.scale === right.scale;

/**
 * Retargets travel from its live presentation toward the latest semantic destination.
 *
 * A geometry change first advances along the previous segment, then makes that exact presentation
 * the origin of the remaining segment. Repeated resize frames therefore keep moving instead of
 * continually restarting, while progress 1 always publishes the latest canonical destination.
 */
export const createMotionPoseSamplerFx = Effect.fn("createMotionPoseSamplerFx")(
	(props: CreateMotionPoseSamplerProps) =>
		Effect.gen(function* (): Effect.fn.Return<MotionPoseSampler> {
			let sampleProgress = 0;
			let completionRetargeted = false;
			let previousTarget: Required<PresentedPose> = {
				scale: props.target.size / Math.max(1, props.actorBaseSize),
				x: props.target.x,
				y: props.target.y,
			};
			const readCurrentTargetFn = () => {
				const liveTarget = props.readLiveTargetFn?.();
				if (liveTarget !== null && liveTarget !== undefined) return liveTarget;
				const currentTarget =
					RendererRuntime.runSync(
						props.surface.readLocationPoseFx(props.targetLocation),
					) ?? props.target;
				return {
					scale: currentTarget.size / Math.max(1, props.actorBaseSize),
					x: currentTarget.x,
					y: currentTarget.y,
				};
			};
			const readPoseFn = yield* createRetargetablePoseSamplerFx({
				from: props.from,
				readTargetFn: () => {
					const nextTarget = readCurrentTargetFn();
					if (sampleProgress >= 1 && !samePoseFn(previousTarget, nextTarget)) {
						completionRetargeted = true;
					}
					previousTarget = nextTarget;
					return nextTarget;
				},
			});
			return {
				needsCompletionSettleFn: () =>
					completionRetargeted || !samePoseFn(previousTarget, readCurrentTargetFn()),
				readPoseFn: (progress) => {
					sampleProgress = progress;
					return readPoseFn(progress);
				},
			};
		}),
);
