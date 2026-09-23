import { Effect } from "effect";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { AnimationCurve } from "~/tile-rendering/service/AnimationDriver";
import { createRetargetablePoseSamplerFx } from "~/tile-rendering/fx/createRetargetablePoseSamplerFx";

interface TargetPose {
	readonly x: number;
	readonly y: number;
}

/** Settles one actor toward live surface geometry while allowing layout retargeting in flight. */
export const animateRetargetablePoseFx = Effect.fn("animateRetargetablePoseFx")(function* ({
	actor,
	animator,
	curve,
	durationMs,
	onCompleteFn,
	readSizeFn,
	readTargetFn,
	target,
}: {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly curve?: AnimationCurve;
	readonly durationMs: number;
	readonly onCompleteFn?: () => void;
	readonly readSizeFn: () => number;
	readonly readTargetFn: () => TargetPose | null;
	readonly target: TargetPose;
}) {
	const readTargetPoseFn = () => {
		const latest = readTargetFn() ?? target;
		return {
			scale: readSizeFn() / Math.max(1, actor.size),
			x: latest.x,
			y: latest.y,
		};
	};
	const readPoseFn = yield* createRetargetablePoseSamplerFx({
		from: {
			scale: actor.container.scale.x,
			x: actor.container.x,
			y: actor.container.y,
		},
		readTargetFn: readTargetPoseFn,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		curve,
		durationMs,
		onCompleteFn,
		// Layout settling has no follow-up leg: a dropped final frame must still
		// land on the latest target before releasing the pose channel.
		readPoseFn: (progress) => (progress === 1 ? readTargetPoseFn() : readPoseFn(progress)),
	});
});
