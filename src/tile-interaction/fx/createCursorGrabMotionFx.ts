import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { AnimationDriver, AnimationSpring } from "~/tile-rendering/service/AnimationDriver";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";

export interface CursorGrabMotion {
	readonly finishFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly startFx: (
		actor: PixiTileActor,
		pointer: {
			readonly x: number;
			readonly y: number;
		},
	) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

interface Props {
	readonly animationDriver: AnimationDriver;
	readonly animator: ActorAnimator;
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
export const createCursorGrabMotionFx = Effect.fn("createCursorGrabMotionFx")(
	({ animationDriver, animator }: Props) =>
		Effect.sync((): CursorGrabMotion => {
			let springs: ReadonlyArray<AnimationSpring> = [];
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
				RendererRuntime.runSync(
					animator.setFx({
						actor,
						channel: "pose",
						scale: actor.container.scale.x,
						x: actor.container.x - actor.container.pivot.x * actor.container.scale.x,
						y: actor.container.y - actor.container.pivot.y * actor.container.scale.y,
					}),
				);
				RendererRuntime.runSync(
					animator.setFx({
						actor,
						channel: "grab-offset",
						pivotX: 0,
						pivotY: 0,
					}),
				);
				if (cleanupFailure !== null) throw cleanupFailure;
			};

			return {
				finishFx: Effect.fn("CursorGrabMotion.finishFx")((actor) =>
					Effect.sync(() => finish(actor)),
				),
				startFx: Effect.fn("CursorGrabMotion.startFx")((actor, pointer) =>
					Effect.sync(() => {
						if (closed) return;
						stop();
						const localPointerX =
							(pointer.x - actor.container.x) /
							Math.max(Number.EPSILON, actor.container.scale.x);
						const localPointerY =
							(pointer.y - actor.container.y) /
							Math.max(Number.EPSILON, actor.container.scale.y);
						const targetPivotX = actor.size / 2 - localPointerX;
						const targetPivotY = actor.size / 2 - localPointerY;
						const x = RendererRuntime.runSync(
							animationDriver.createSpringFx({
								initialValue: actor.container.pivot.x,
								onUpdate: (value) => {
									if (closed || actor.container.destroyed) return;
									RendererRuntime.runSync(
										animator.setFx({
											actor,
											channel: "grab-offset",
											pivotX: value,
											pivotY: actor.container.pivot.y,
										}),
									);
								},
								options: cursorGrabSpring,
							}),
						);
						let y: AnimationSpring;
						try {
							y = RendererRuntime.runSync(
								animationDriver.createSpringFx({
									initialValue: actor.container.pivot.y,
									onUpdate: (value) => {
										if (closed || actor.container.destroyed) return;
										RendererRuntime.runSync(
											animator.setFx({
												actor,
												channel: "grab-offset",
												pivotX: actor.container.pivot.x,
												pivotY: value,
											}),
										);
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
