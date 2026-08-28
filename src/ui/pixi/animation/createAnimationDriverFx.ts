import { Effect } from "effect";
import {
	animate,
	type AnimationPlaybackControls,
	type MotionValue,
	motionValue,
	springValue,
} from "motion";

import { RendererRuntime } from "~/renderer/RendererRuntime";
import type {
	AnimationControl,
	AnimationDriver,
	AnimationSpring,
} from "~/ui/pixi/animation/AnimationDriver";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createAnimationDriverFx {
	export interface Props {
		readonly cancelFrame?: (frameId: number) => void;
		readonly frames: DemandFrameLoop;
		readonly requestFrame?: (callback: FrameRequestCallback) => number;
	}
}

/**
 * Owns Motion controls and springs without exposing Motion or React to Pixi domains.
 *
 * Motion is only the interpolation clock. Every update invalidates Pixi's demand renderer, and
 * closing the driver stops all deferred callbacks before its scene destroys display objects.
 */
export const createAnimationDriverFx = Effect.fn("createAnimationDriverFx")(
	({
		cancelFrame = cancelAnimationFrame,
		frames,
		requestFrame = requestAnimationFrame,
	}: createAnimationDriverFx.Props) =>
		Effect.sync((): AnimationDriver => {
			const activeClosers = new Set<() => void>();
			let closed = false;

			const invalidate = () => RendererRuntime.runSync(frames.invalidateFx);
			const inactiveControl: AnimationControl = {
				stopFx: Effect.void,
			};
			const inactiveSpring: AnimationSpring = {
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
				createSpringFx: Effect.fn("AnimationDriver.createSpringFx")(
					({ initialValue, onUpdate, options }) =>
						Effect.sync((): AnimationSpring => {
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
								setTargetFx: Effect.fnUntraced(function* (nextValue) {
									if (closed || springClosed) return;
									target.set(nextValue);
								}),
							};
						}),
				),
				startTweenFx: Effect.fn("AnimationDriver.startTweenFx")(
					({
						curve = {
							kind: "ease-in-out",
						},
						delayMs = 0,
						durationMs,
						from,
						onComplete,
						onUpdate,
						repeat,
						to,
					}) =>
						Effect.sync((): AnimationControl => {
							if (closed) return inactiveControl;
							let controls: AnimationPlaybackControls | null = null;
							let completionFrameId: number | null = null;
							const playback: {
								state: "active" | "completing" | "completed" | "stopped";
							} = {
								state: "active",
							};
							const stop = () => {
								if (
									playback.state === "completed" ||
									playback.state === "stopped"
								) {
									return;
								}
								playback.state = "stopped";
								activeClosers.delete(stop);
								if (completionFrameId !== null) {
									cancelFrame(completionFrameId);
									completionFrameId = null;
								} else {
									controls?.stop();
								}
							};
							activeClosers.add(stop);
							try {
								const timing =
									curve.kind === "spring"
										? {
												bounce: curve.bounce,
												type: "spring" as const,
												visualDuration: durationMs / 1000,
											}
										: {
												duration: durationMs / 1000,
												ease:
													curve.kind === "linear"
														? ("linear" as const)
														: ("easeInOut" as const),
												repeat,
												type: "keyframes" as const,
											};
								controls = animate(from, to, {
									delay: delayMs / 1000,
									...timing,
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
										playback.state = "completing";
										completionFrameId = requestFrame(() => {
											completionFrameId = null;
											if (closed || playback.state !== "completing") return;
											playback.state = "completed";
											activeClosers.delete(stop);
											try {
												onComplete?.();
											} catch (cause) {
												frames.reportCriticalFailure(cause);
											}
										});
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
