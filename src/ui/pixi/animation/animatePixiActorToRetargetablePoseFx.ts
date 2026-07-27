import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createPixiRetargetablePoseSamplerFx";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";

interface TargetPose {
	readonly x: number;
	readonly y: number;
}

/** Settles one actor toward live surface geometry while allowing layout retargeting in flight. */
export const animatePixiActorToRetargetablePoseFx = Effect.fn(
	"animatePixiActorToRetargetablePoseFx",
)(function* ({
	actor,
	animator,
	onCancel,
	onComplete,
	ownerKey,
	readSize,
	readTarget,
	target,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly onCancel?: () => void;
	readonly onComplete?: () => void;
	readonly ownerKey?: string;
	readonly readSize: () => number;
	readonly readTarget: () => TargetPose | null;
	readonly target: TargetPose;
}) {
	const durationMs = yield* readPixiTileTravelDurationMsFx({
		fromX: actor.container.x,
		fromY: actor.container.y,
		tileSize: actor.size,
		toX: target.x,
		toY: target.y,
	});
	const readPose = yield* createPixiRetargetablePoseSamplerFx({
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
		durationMs,
		onCancel,
		onComplete,
		ownerKey,
		readPose,
	});
});
