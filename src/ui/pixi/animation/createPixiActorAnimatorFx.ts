import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	PixiAnimationControl,
	PixiAnimationDriver,
} from "~/ui/pixi/animation/PixiAnimationDriver";
import type { PixiActorAnimation, PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

export namespace createPixiActorAnimatorFx {
	export interface Props {
		readonly animationDriver: PixiAnimationDriver;
	}
}

interface ActiveAnimation {
	control: PixiAnimationControl | null;
}

/**
 * Owns interruptible, keyed writes from Motion into retained Pixi display objects.
 *
 * An animation key is an ownership key: starting a successor first cancels the previous writer.
 * Callers must use stable per-channel keys when transform and opacity lifecycles may overlap.
 */
export const createPixiActorAnimatorFx = Effect.fn("createPixiActorAnimatorFx")(
	({ animationDriver }: createPixiActorAnimatorFx.Props) =>
		Effect.sync((): PixiActorAnimator => {
			const animations = new Map<string, ActiveAnimation>();
			let closed = false;

			const cancel = (animationKey: string) => {
				const animation = animations.get(animationKey);
				animations.delete(animationKey);
				if (animation?.control !== null && animation !== undefined) {
					RendererRuntime.runSync(animation.control.stopFx);
				}
			};

			const animateFx = Effect.fn("PixiActorAnimator.animateFx")(
				({
					actor,
					animationKey = actor.item.id,
					delayMs = 0,
					durationMs,
					onComplete,
					toAlpha,
					toCrowdAlpha,
					toScale,
					toX,
					toY,
				}: PixiActorAnimation) =>
					Effect.sync(() => {
						if (closed) return;
						cancel(animationKey);
						const fromX = actor.container.x;
						const fromY = actor.container.y;
						const fromAlpha = actor.container.alpha;
						const fromCrowdAlpha =
							toCrowdAlpha === undefined ? null : actor.crowdLayer.alpha;
						const fromScale = actor.container.scale.x;
						const activeAnimation: ActiveAnimation = {
							control: null,
						};
						animations.set(animationKey, activeAnimation);
						try {
							activeAnimation.control = RendererRuntime.runSync(
								animationDriver.startTweenFx({
									delayMs,
									durationMs,
									from: 0,
									onUpdate: (progress) => {
										if (closed || actor.container.destroyed) return;
										if (toX !== undefined) {
											actor.container.x = fromX + (toX - fromX) * progress;
										}
										if (toY !== undefined) {
											actor.container.y = fromY + (toY - fromY) * progress;
										}
										if (toAlpha !== undefined) {
											actor.container.alpha =
												fromAlpha + (toAlpha - fromAlpha) * progress;
										}
										if (fromCrowdAlpha !== null && toCrowdAlpha !== undefined) {
											actor.crowdLayer.alpha =
												fromCrowdAlpha +
												(toCrowdAlpha - fromCrowdAlpha) * progress;
										}
										if (toScale !== undefined) {
											actor.container.scale.set(
												fromScale + (toScale - fromScale) * progress,
											);
										}
									},
									onComplete: () => {
										if (animations.get(animationKey) !== activeAnimation)
											return;
										animations.delete(animationKey);
										onComplete?.();
									},
									to: 1,
								}),
							);
						} catch (cause) {
							if (animations.get(animationKey) === activeAnimation) {
								animations.delete(animationKey);
							}
							throw cause;
						}
					}),
			);

			return {
				animateFx,
				cancelFx: Effect.fn("PixiActorAnimator.cancelFx")((animationKey) =>
					Effect.sync(() => cancel(animationKey)),
				),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					const failures: unknown[] = [];
					for (const animation of animations.values()) {
						if (animation.control === null) continue;
						try {
							RendererRuntime.runSync(animation.control.stopFx);
						} catch (cause) {
							failures.push(cause);
						}
					}
					animations.clear();
					if (failures.length > 0) {
						throw new AggregateError(failures, "Pixi actor animation cleanup failed.");
					}
				}),
			};
		}),
);
