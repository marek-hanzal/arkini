import { Effect } from "effect";

import type { PresentedPose } from "~/tile-rendering/service/ActorAnimator";

export namespace createRetargetablePoseSamplerFx {
	export interface Props {
		readonly from: Required<PresentedPose>;
		readonly readTargetFn: () => Required<PresentedPose>;
	}
}

const samePoseFn = (left: Required<PresentedPose>, right: Required<PresentedPose>) =>
	left.x === right.x && left.y === right.y && left.scale === right.scale;

const mixFn = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Keeps the live sample continuous while a running pose animation receives a newer target. */
export const createRetargetablePoseSamplerFx = Effect.fn("createRetargetablePoseSamplerFx")(
	({ from, readTargetFn }: createRetargetablePoseSamplerFx.Props) =>
		Effect.sync(() => {
			let segmentOrigin = from;
			let segmentStart = 0;
			let target = readTargetFn();
			let lastPose = from;

			return (progress: number): Required<PresentedPose> => {
				const nextTarget = readTargetFn();
				const remainingProgress =
					segmentStart >= 1 ? 0 : (progress - segmentStart) / (1 - segmentStart);
				const advancedPose = {
					scale: mixFn(segmentOrigin.scale, target.scale, remainingProgress),
					x: mixFn(segmentOrigin.x, target.x, remainingProgress),
					y: mixFn(segmentOrigin.y, target.y, remainingProgress),
				};
				if (!samePoseFn(nextTarget, target)) {
					segmentOrigin = advancedPose;
					segmentStart = progress;
					target = nextTarget;
				}
				lastPose = advancedPose;
				return lastPose;
			};
		}),
);
