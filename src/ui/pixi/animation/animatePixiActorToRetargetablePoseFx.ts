import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiAnimationCurve } from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiRectangularRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createPixiRectangularRetargetablePoseSamplerFx";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";

interface TargetPose {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

/** Settles one actor toward live surface geometry while allowing layout retargeting in flight. */
export const animatePixiActorToRetargetablePoseFx = Effect.fn(
	"animatePixiActorToRetargetablePoseFx",
)(function* ({
	actor,
	animator,
	curve,
	durationMs: requestedDurationMs,
	onCancel,
	onComplete,
	ownerKey,
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
	readonly readTarget: () => TargetPose | null;
	readonly target: TargetPose;
}) {
	const durationMs =
		requestedDurationMs ??
		(yield* readPixiTileTravelDurationMsFx({
			fromX: actor.container.x,
			fromY: actor.container.y,
			tileSize: actor.size,
			toX: target.x,
			toY: target.y,
		}));
	const readPose = yield* createPixiRectangularRetargetablePoseSamplerFx({
		from: {
			scaleX: actor.container.scale.x,
			scaleY: actor.container.scale.y,
			x: actor.container.x,
			y: actor.container.y,
		},
		readTarget: () => {
			const latest = readTarget() ?? target;
			return {
				scaleX: latest.width / Math.max(1, actor.width),
				scaleY: latest.height / Math.max(1, actor.height),
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
