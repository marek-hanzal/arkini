import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPixiCursorGrabMotionFx {
	export interface Props {
		readonly animationDriver: PixiAnimationDriver;
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
	({ animationDriver, frames }: createPixiCursorGrabMotionFx.Props) =>
		Effect.sync((): PixiCursorGrabMotion => {
			let springs: ReadonlyArray<PixiAnimationSpring> = [];
			let closed = false;

			const stop = () => {
				const failures: unknown[] = [];
				for (const spring of springs) {
					try {
						RendererRuntime.runSync(spring.closeFx);
					} catch (cause) {
						failures.push(cause);
					}
				}
				springs = [];
				if (failures.length > 0) {
					throw new AggregateError(failures, "Pixi cursor spring cleanup failed.");
				}
			};

			const finish = (actor: PixiTileActor) => {
				let cleanupFailure: unknown = null;
				try {
					stop();
				} catch (cause) {
					cleanupFailure = cause;
				}
				actor.container.x -= actor.container.pivot.x;
				actor.container.y -= actor.container.pivot.y;
				actor.container.pivot.set(0);
				RendererRuntime.runSync(frames.invalidateFx);
				if (cleanupFailure !== null) throw cleanupFailure;
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
						const x = RendererRuntime.runSync(
							animationDriver.createSpringFx({
								initialValue: actor.container.pivot.x,
								onUpdate: (value) => {
									if (closed || actor.container.destroyed) return;
									actor.container.pivot.x = value;
								},
								options: cursorGrabSpring,
							}),
						);
						let y: PixiAnimationSpring;
						try {
							y = RendererRuntime.runSync(
								animationDriver.createSpringFx({
									initialValue: actor.container.pivot.y,
									onUpdate: (value) => {
										if (closed || actor.container.destroyed) return;
										actor.container.pivot.y = value;
									},
									options: cursorGrabSpring,
								}),
							);
						} catch (cause) {
							RendererRuntime.runSync(x.closeFx);
							throw cause;
						}
						springs = [
							x,
							y,
						];
						RendererRuntime.runSync(x.setTargetFx(targetPivotX));
						RendererRuntime.runSync(y.setTargetFx(targetPivotY));
					}),
				),
				closeFx: Effect.sync(() => {
					closed = true;
					stop();
				}),
			};
		}),
);
