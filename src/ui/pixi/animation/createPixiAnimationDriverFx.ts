import { Effect } from "effect";
import {
	animate,
	type AnimationPlaybackControls,
	type MotionValue,
	motionValue,
	springValue,
} from "motion";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	PixiAnimationControl,
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPixiAnimationDriverFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
	}
}

/**
 * Owns Motion controls and springs without exposing Motion or React to Pixi domains.
 *
 * Motion is only the interpolation clock. Every update invalidates Pixi's demand renderer, and
 * closing the driver stops all deferred callbacks before its scene destroys display objects.
 */
export const createPixiAnimationDriverFx = Effect.fn("createPixiAnimationDriverFx")(
	({ frames }: createPixiAnimationDriverFx.Props) =>
		Effect.sync((): PixiAnimationDriver => {
			const activeClosers = new Set<() => void>();
			let closed = false;

			const invalidate = () => RendererRuntime.runSync(frames.invalidateFx);
			const inactiveControl: PixiAnimationControl = {
				stopFx: Effect.void,
			};
			const inactiveSpring: PixiAnimationSpring = {
				closeFx: Effect.void,
				setTargetFx: () => Effect.void,
			};
			const disposeAll = (disposers: ReadonlyArray<() => void>, message: string) => {
				const failures: unknown[] = [];
				for (const dispose of disposers) {
					try {
						dispose();
					} catch (cause) {
						failures.push(cause);
					}
				}
				if (failures.length > 0) throw new AggregateError(failures, message);
			};

			return {
				createSpringFx: Effect.fn("PixiAnimationDriver.createSpringFx")(
					({ initialValue, onUpdate, options }) =>
						Effect.sync((): PixiAnimationSpring => {
							if (closed) return inactiveSpring;
							const target = motionValue(initialValue);
							let value: MotionValue<number>;
							try {
								value = springValue<number>(target, options);
							} catch (cause) {
								disposeAll(
									[
										() => target.destroy(),
									],
									"Pixi spring acquisition cleanup failed.",
								);
								throw cause;
							}
							let springClosed = false;
							let removeChangeListener: () => void;
							try {
								removeChangeListener = value.on("change", (latest) => {
									if (closed || springClosed) return;
									try {
										onUpdate(latest);
									} catch (cause) {
										frames.reportCriticalFailure(cause);
									} finally {
										invalidate();
									}
								});
							} catch (cause) {
								disposeAll(
									[
										() => value.destroy(),
										() => target.destroy(),
									],
									"Pixi spring subscription cleanup failed.",
								);
								throw cause;
							}
							const close = () => {
								if (springClosed) return;
								springClosed = true;
								activeClosers.delete(close);
								disposeAll(
									[
										removeChangeListener,
										// springValue defers retargeting to Motion's post-render step.
										// Settling first makes an already queued callback a no-op after teardown.
										() => value.jump(target.get()),
										() => value.destroy(),
										() => target.destroy(),
									],
									"Pixi spring cleanup failed.",
								);
							};
							activeClosers.add(close);
							return {
								closeFx: Effect.sync(close),
								setTargetFx: Effect.fn("PixiAnimationSpring.setTargetFx")(
									(nextValue) =>
										Effect.sync(() => {
											if (closed || springClosed) return;
											target.set(nextValue);
										}),
								),
							};
						}),
				),
				startTweenFx: Effect.fn("PixiAnimationDriver.startTweenFx")(
					({ delayMs = 0, durationMs, from, onComplete, onUpdate, to }) =>
						Effect.sync((): PixiAnimationControl => {
							if (closed) return inactiveControl;
							let controls: AnimationPlaybackControls | null = null;
							const playback: {
								state: "active" | "completed" | "stopped";
							} = {
								state: "active",
							};
							const stop = () => {
								if (playback.state !== "active") return;
								playback.state = "stopped";
								activeClosers.delete(stop);
								controls?.stop();
							};
							activeClosers.add(stop);
							try {
								controls = animate(from, to, {
									delay: delayMs / 1000,
									duration: durationMs / 1000,
									ease: "easeInOut",
									onUpdate: (latest) => {
										if (closed || playback.state !== "active") return;
										try {
											onUpdate(latest);
										} catch (cause) {
											frames.reportCriticalFailure(cause);
										} finally {
											invalidate();
										}
									},
									onComplete: () => {
										if (closed || playback.state !== "active") return;
										playback.state = "completed";
										activeClosers.delete(stop);
										try {
											onComplete?.();
										} catch (cause) {
											frames.reportCriticalFailure(cause);
										}
									},
								});
							} catch (cause) {
								playback.state = "stopped";
								activeClosers.delete(stop);
								throw cause;
							}
							if (playback.state === "stopped") controls.stop();
							return {
								stopFx: Effect.sync(stop),
							};
						}),
				),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					try {
						disposeAll(
							[
								...activeClosers,
							],
							"Pixi animation cleanup failed.",
						);
					} finally {
						activeClosers.clear();
					}
				}),
			};
		}),
);
