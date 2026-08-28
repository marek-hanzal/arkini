import { Effect } from "effect";

import type { PresentedPose } from "~/ui/pixi/animation/ActorAnimator";

export namespace createRetargetablePoseSamplerFx {
	export interface Props {
		readonly from: Required<PresentedPose>;
		readonly readTarget: () => Required<PresentedPose>;
	}
}

const samePose = (left: Required<PresentedPose>, right: Required<PresentedPose>) =>
	left.x === right.x && left.y === right.y && left.scale === right.scale;

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Keeps the live sample continuous while a running pose animation receives a newer target. */
export const createRetargetablePoseSamplerFx = Effect.fn("createRetargetablePoseSamplerFx")(
	({ from, readTarget }: createRetargetablePoseSamplerFx.Props) =>
		Effect.sync(() => {
			let segmentOrigin = from;
			let segmentStart = 0;
			let target = readTarget();
			let lastPose = from;

			return (progress: number): Required<PresentedPose> => {
				const nextTarget = readTarget();
				const remainingProgress =
					segmentStart >= 1 ? 0 : (progress - segmentStart) / (1 - segmentStart);
				const advancedPose = {
					scale: mix(segmentOrigin.scale, target.scale, remainingProgress),
					x: mix(segmentOrigin.x, target.x, remainingProgress),
					y: mix(segmentOrigin.y, target.y, remainingProgress),
				};
				if (!samePose(nextTarget, target)) {
					segmentOrigin = advancedPose;
					segmentStart = progress;
					target = nextTarget;
				}
				lastPose = advancedPose;
				return lastPose;
			};
		}),
);
