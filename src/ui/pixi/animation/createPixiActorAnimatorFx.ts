import { Effect } from "effect";
import { animate, type AnimationPlaybackControls } from "motion/react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiActorAnimation, PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPixiActorAnimatorFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
	}
}

interface ActiveAnimation {
	readonly controls: AnimationPlaybackControls;
}

/** Uses Motion as the sole runtime for interruptible Pixi display-object interpolation. */
export const createPixiActorAnimatorFx = Effect.fn("createPixiActorAnimatorFx")(
	({ frames }: createPixiActorAnimatorFx.Props) =>
		Effect.sync((): PixiActorAnimator => {
			const animations = new Map<string, ActiveAnimation>();
			let closed = false;

			const cancel = (animationKey: string) => {
				animations.get(animationKey)?.controls.stop();
				animations.delete(animationKey);
			};

			const animateFx = Effect.fn("PixiActorAnimator.animateFx")(
				({
					actor,
					animationKey = actor.item.id,
					delayMs = 0,
					durationMs,
					onComplete,
					toAlpha,
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
						const fromScale = actor.container.scale.x;
						const targetAlpha = toAlpha ?? fromAlpha;
						const targetScale = toScale ?? fromScale;
						const controls = animate(0, 1, {
							delay: delayMs / 1000,
							duration: durationMs / 1000,
							ease: "easeInOut",
							onUpdate: (progress) => {
								if (closed || actor.container.destroyed) return;
								actor.container.x = fromX + (toX - fromX) * progress;
								actor.container.y = fromY + (toY - fromY) * progress;
								actor.container.alpha =
									fromAlpha + (targetAlpha - fromAlpha) * progress;
								actor.container.scale.set(
									fromScale + (targetScale - fromScale) * progress,
								);
								RendererRuntime.runSync(frames.invalidateFx);
							},
							onComplete: () => {
								animations.delete(animationKey);
								onComplete?.();
							},
						});
						animations.set(animationKey, {
							controls,
						});
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
					for (const animation of animations.values()) animation.controls.stop();
					animations.clear();
				}),
			};
		}),
);
