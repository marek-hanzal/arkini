import { Effect } from "effect";

import type { PixiActorUniformPose } from "~/ui/pixi/animation/PixiActorAnimator";

export namespace createPixiRetargetablePoseSamplerFx {
	export interface Props {
		readonly from: PixiActorUniformPose;
		readonly readTarget: () => PixiActorUniformPose;
	}
}

const samePose = (left: PixiActorUniformPose, right: PixiActorUniformPose) =>
	left.x === right.x && left.y === right.y && left.scale === right.scale;

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Keeps the live sample continuous while a running pose animation receives a newer target. */
export const createPixiRetargetablePoseSamplerFx = Effect.fn("createPixiRetargetablePoseSamplerFx")(
	({ from, readTarget }: createPixiRetargetablePoseSamplerFx.Props) =>
		Effect.sync(() => {
			let segmentOrigin = from;
			let segmentStart = 0;
			let target = readTarget();
			let lastPose = from;

			return (progress: number): PixiActorUniformPose => {
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
