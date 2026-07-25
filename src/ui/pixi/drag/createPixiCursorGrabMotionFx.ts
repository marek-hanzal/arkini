import { Effect } from "effect";
import { animate, type AnimationPlaybackControls } from "motion/react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPixiCursorGrabMotionFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
	}
}

const cursorGrabSpring = {
	type: "spring",
	stiffness: 560,
	damping: 38,
	mass: 0.85,
	restDelta: 0.05,
	restSpeed: 0.05,
	velocity: 0,
} as const;

/** Uses Motion springs to settle a dragged tile's center beneath the pointer. */
export const createPixiCursorGrabMotionFx = Effect.fn("createPixiCursorGrabMotionFx")(
	({ frames }: createPixiCursorGrabMotionFx.Props) =>
		Effect.sync((): PixiCursorGrabMotion => {
			let controls: ReadonlyArray<AnimationPlaybackControls> = [];
			let closed = false;

			const stop = () => {
				for (const control of controls) control.stop();
				controls = [];
			};

			const finish = (actor: PixiTileActor) => {
				stop();
				actor.container.x -= actor.container.pivot.x;
				actor.container.y -= actor.container.pivot.y;
				actor.container.pivot.set(0);
				RendererRuntime.runSync(frames.invalidateFx);
			};

			return {
				finishFx: Effect.fn("PixiCursorGrabMotion.finishFx")((actor) =>
					Effect.sync(() => finish(actor)),
				),
				startFx: Effect.fn("PixiCursorGrabMotion.startFx")((actor, pointer) =>
					Effect.sync(() => {
						if (closed) return;
						stop();
						const localPointerX = pointer.x - actor.container.x;
						const localPointerY = pointer.y - actor.container.y;
						const targetPivotX = actor.size / 2 - localPointerX;
						const targetPivotY = actor.size / 2 - localPointerY;
						controls = [
							animate(actor.container.pivot.x, targetPivotX, {
								...cursorGrabSpring,
								onUpdate: (value) => {
									if (closed || actor.container.destroyed) return;
									actor.container.pivot.x = value;
									RendererRuntime.runSync(frames.invalidateFx);
								},
							}),
							animate(actor.container.pivot.y, targetPivotY, {
								...cursorGrabSpring,
								onUpdate: (value) => {
									if (closed || actor.container.destroyed) return;
									actor.container.pivot.y = value;
									RendererRuntime.runSync(frames.invalidateFx);
								},
							}),
						];
					}),
				),
				closeFx: Effect.sync(() => {
					closed = true;
					stop();
				}),
			};
		}),
);
