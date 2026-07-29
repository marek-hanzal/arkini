import { Effect } from "effect";

import type { PixiActorPresentedPose } from "~/ui/pixi/animation/PixiActorAnimator";

export interface PixiActorRectangularPose extends PixiActorPresentedPose {
	readonly scaleX: number;
	readonly scaleY: number;
}

export namespace createPixiRectangularRetargetablePoseSamplerFx {
	export interface Props {
		readonly from: PixiActorRectangularPose;
		readonly readTarget: () => PixiActorRectangularPose;
	}
}

const samePose = (left: PixiActorRectangularPose, right: PixiActorRectangularPose) =>
	left.x === right.x &&
	left.y === right.y &&
	left.scaleX === right.scaleX &&
	left.scaleY === right.scaleY;

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Keeps a rectangular actor continuous while live surface geometry retargets its pose. */
export const createPixiRectangularRetargetablePoseSamplerFx = Effect.fn(
	"createPixiRectangularRetargetablePoseSamplerFx",
)(({ from, readTarget }: createPixiRectangularRetargetablePoseSamplerFx.Props) =>
	Effect.sync(() => {
		let segmentOrigin = from;
		let segmentStart = 0;
		let target = readTarget();

		return (progress: number): PixiActorRectangularPose => {
			const nextTarget = readTarget();
			const remainingProgress =
				segmentStart >= 1 ? 0 : (progress - segmentStart) / (1 - segmentStart);
			const advancedPose = {
				scaleX: mix(segmentOrigin.scaleX, target.scaleX, remainingProgress),
				scaleY: mix(segmentOrigin.scaleY, target.scaleY, remainingProgress),
				x: mix(segmentOrigin.x, target.x, remainingProgress),
				y: mix(segmentOrigin.y, target.y, remainingProgress),
			};
			if (!samePose(nextTarget, target)) {
				segmentOrigin = advancedPose;
				segmentStart = progress;
				target = nextTarget;
			}
			return advancedPose;
		};
	}),
);
