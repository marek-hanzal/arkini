import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

/** Writes one pointer-owned actor pose through the canonical animator channel. */
export const setPixiDraggedActorPoseFx = Effect.fn("setPixiDraggedActorPoseFx")(
	({
		actor,
		animator,
		x,
		y,
	}: {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly x: number;
		readonly y: number;
	}) =>
		animator.setFx({
			actor,
			channel: "pose",
			scale: actor.container.scale.x,
			x,
			y,
		}),
);
