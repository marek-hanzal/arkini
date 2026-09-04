import { Effect } from "effect";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { AnimationCurve } from "~/tile-rendering/service/AnimationDriver";
import { createRetargetablePoseSamplerFx } from "~/tile-rendering/fx/createRetargetablePoseSamplerFx";
import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";

interface TargetPose {
	readonly x: number;
	readonly y: number;
}

/** Settles one actor toward live surface geometry while allowing layout retargeting in flight. */
export const animateRetargetablePoseFx = Effect.fn("animateRetargetablePoseFx")(function* ({
	actor,
	animator,
	curve,
	durationMs: requestedDurationMs,
	onCancelFn,
	onCompleteFn,
	ownerKey,
	readSizeFn,
	readTargetFn,
	target,
}: {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly curve?: AnimationCurve;
	readonly durationMs?: number;
	readonly onCancelFn?: () => void;
	readonly onCompleteFn?: () => void;
	readonly ownerKey?: string;
	readonly readSizeFn: () => number;
	readonly readTargetFn: () => TargetPose | null;
	readonly target: TargetPose;
}) {
	const durationMs =
		requestedDurationMs ??
		readTravelDurationMsFn({
			fromX: actor.container.x,
			fromY: actor.container.y,
			tileSize: actor.size,
			toX: target.x,
			toY: target.y,
		});
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
		onCancelFn,
		onCompleteFn,
		ownerKey,
		// Layout settling has no follow-up leg: a dropped final frame must still
		// land on the latest target before releasing the pose channel.
		readPoseFn: (progress) => (progress === 1 ? readTargetPoseFn() : readPoseFn(progress)),
	});
});
