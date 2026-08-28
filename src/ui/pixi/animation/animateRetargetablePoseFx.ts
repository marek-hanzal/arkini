import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiAnimationCurve } from "~/ui/pixi/animation/PixiAnimationDriver";
import { createRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createRetargetablePoseSamplerFx";
import { readTravelDurationMsFx } from "~/ui/pixi/animation/readTravelDurationMsFx";

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
	onCancel,
	onComplete,
	ownerKey,
	readSize,
	readTarget,
	target,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly curve?: PixiAnimationCurve;
	readonly durationMs?: number;
	readonly onCancel?: () => void;
	readonly onComplete?: () => void;
	readonly ownerKey?: string;
	readonly readSize: () => number;
	readonly readTarget: () => TargetPose | null;
	readonly target: TargetPose;
}) {
	const durationMs =
		requestedDurationMs ??
		(yield* readTravelDurationMsFx({
			fromX: actor.container.x,
			fromY: actor.container.y,
			tileSize: actor.size,
			toX: target.x,
			toY: target.y,
		}));
	const readPose = yield* createRetargetablePoseSamplerFx({
		from: {
			scale: actor.container.scale.x,
			x: actor.container.x,
			y: actor.container.y,
		},
		readTarget: () => {
			const latest = readTarget() ?? target;
			return {
				scale: readSize() / Math.max(1, actor.size),
				x: latest.x,
				y: latest.y,
			};
		},
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		curve,
		durationMs,
		onCancel,
		onComplete,
		ownerKey,
		readPose,
	});
});
