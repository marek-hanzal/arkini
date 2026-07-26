import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

export namespace runPixiTileActorRunningGlowFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}

const minimumAlpha = 0.28;
const maximumAlpha = 0.62;
const halfCycleDurationMs = 2_400;
const fadeDurationMs = 640;
const feedbackPeakAlpha = 0.82;
export const pixiTileActorFeedbackGlowRiseDurationMs = 110;
export const pixiTileActorFeedbackGlowFallDurationMs = 520;

export const readPixiTileActorRunningGlowAnimationKey = (actor: PixiTileActor) =>
	`running-glow:${actor.instanceId}`;

export const readPixiTileActorFeedbackGlowAnimationKey = (actor: PixiTileActor) =>
	`feedback-glow:${actor.instanceId}`;

/** Fades the circular glow in, then starts one gentle 4.8 second pulse. */
export const startPixiTileActorRunningGlowFx = Effect.fn("startPixiTileActorRunningGlowFx")(
	function* ({ actor, animator }: runPixiTileActorRunningGlowFx.Props) {
		const animationKey = readPixiTileActorRunningGlowAnimationKey(actor);
		yield* animator.cancelFx(animationKey);
		yield* animator.setFx({
			actor,
			channel: "glow-opacity",
			visible: true,
		});

		const pulseTo = (alpha: number) => {
			RendererRuntime.runSync(
				animator.animateFx({
					actor,
					channel: "glow-opacity",
					durationMs: halfCycleDurationMs,
					ownerKey: animationKey,
					onComplete: () => {
						if (
							actor.container.destroyed ||
							!actor.item.runningGlow ||
							!actor.runningGlow.visible
						) {
							return;
						}
						pulseTo(alpha === maximumAlpha ? minimumAlpha : maximumAlpha);
					},
					toRunningGlowAlpha: alpha,
				}),
			);
		};
		yield* animator.animateFx({
			actor,
			channel: "glow-opacity",
			durationMs: fadeDurationMs,
			ownerKey: animationKey,
			onComplete: () => {
				if (
					actor.container.destroyed ||
					!actor.item.runningGlow ||
					!actor.runningGlow.visible
				) {
					return;
				}
				pulseTo(minimumAlpha);
			},
			toRunningGlowAlpha: maximumAlpha,
		});
	},
);

/** Interrupts the pulse and fades its glow-only channel out before hiding it. */
export const stopPixiTileActorRunningGlowFx = Effect.fn("stopPixiTileActorRunningGlowFx")(
	function* ({ actor, animator }: runPixiTileActorRunningGlowFx.Props) {
		const animationKey = readPixiTileActorRunningGlowAnimationKey(actor);
		yield* animator.cancelFx(animationKey);
		yield* animator.animateFx({
			actor,
			channel: "glow-opacity",
			durationMs: fadeDurationMs,
			ownerKey: animationKey,
			onComplete: () => {
				if (actor.container.destroyed || actor.item.runningGlow) return;
				RendererRuntime.runSync(
					animator.setFx({
						actor,
						channel: "glow-opacity",
						visible: false,
					}),
				);
			},
			toRunningGlowAlpha: 0,
		});
	},
);

/**
 * Reuses the actor-owned glow sprite for one interruptible feedback flash.
 *
 * A running producer resumes its persistent pulse after the flash. A neutral actor fades back to
 * zero and hides the sprite, so feedback never leaves a second opacity writer behind.
 */
export const flashPixiTileActorFeedbackGlowFx = Effect.fn("flashPixiTileActorFeedbackGlowFx")(
	function* ({ actor, animator }: runPixiTileActorRunningGlowFx.Props) {
		if (actor.container.destroyed) return;
		const animationKey = readPixiTileActorFeedbackGlowAnimationKey(actor);
		yield* animator.cancelFx(animationKey);
		yield* animator.setFx({
			actor,
			channel: "glow-opacity",
			visible: true,
		});
		yield* animator.animateFx({
			actor,
			channel: "glow-opacity",
			durationMs: pixiTileActorFeedbackGlowRiseDurationMs,
			ownerKey: animationKey,
			onComplete: () => {
				if (actor.container.destroyed) return;
				if (actor.item.runningGlow) {
					RendererRuntime.runSync(
						startPixiTileActorRunningGlowFx({
							actor,
							animator,
						}),
					);
					return;
				}
				RendererRuntime.runSync(
					animator.animateFx({
						actor,
						channel: "glow-opacity",
						durationMs: pixiTileActorFeedbackGlowFallDurationMs,
						ownerKey: animationKey,
						onComplete: () => {
							if (actor.container.destroyed || actor.item.runningGlow) return;
							RendererRuntime.runSync(
								animator.setFx({
									actor,
									channel: "glow-opacity",
									visible: false,
								}),
							);
						},
						toRunningGlowAlpha: 0,
					}),
				);
			},
			toRunningGlowAlpha: feedbackPeakAlpha,
		});
	},
);
