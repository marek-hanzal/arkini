import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";

interface ActivityParticlesProps {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly rampIn?: boolean;
}

type ParticlePlaybackKind = "burst" | "running";

const runningCycleDurationMs = 1_760;
const runningRampDurationMs = 520;
const drainDurationMs = 460;
export const feedbackDurationMs = 720;
const waveTurns = 1.15;
const shimmerTurns = 2.35;
const twoPi = Math.PI * 2;

const readActivityAnimationKeyFn = (actor: PixiTileActor) =>
	`activity-particles:${actor.instanceId}`;

const clampUnitFn = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubicFn = (value: number) => 1 - (1 - value) ** 3;
const smoothEnvelopeFn = (value: number) => Math.sin(Math.PI * clampUnitFn(value)) ** 1.35;
const smoothStepFn = (value: number) => {
	const unit = clampUnitFn(value);
	return unit * unit * (3 - 2 * unit);
};
const mixFn = (from: number, to: number, progress: number) => from + (to - from) * progress;

const mixChannelFn = (channel: number, target: number, amount: number) =>
	Math.round(channel + (target - channel) * amount);
const mixTintFn = (from: number, to: number, progress: number) => {
	const red = Math.round(mixFn((from >> 16) & 0xff, (to >> 16) & 0xff, progress));
	const green = Math.round(mixFn((from >> 8) & 0xff, (to >> 8) & 0xff, progress));
	const blue = Math.round(mixFn(from & 0xff, to & 0xff, progress));
	return (red << 16) | (green << 8) | blue;
};

/** Preserves the semantic hue while pushing each shimmer toward the contrast side of its surface. */
const readShimmerTintFn = (tint: number, shimmer: number, lightSurface: boolean) => {
	const unitShimmer = clampUnitFn(shimmer);
	const amount = lightSurface ? 0.06 + unitShimmer ** 2 * 0.48 : unitShimmer ** 3 * 0.38;
	const target = lightSurface ? 0 : 255;
	const red = mixChannelFn((tint >> 16) & 0xff, target, amount);
	const green = mixChannelFn((tint >> 8) & 0xff, target, amount);
	const blue = mixChannelFn(tint & 0xff, target, amount);
	return (red << 16) | (green << 8) | blue;
};

const renderParticlesFn = ({
	actor,
	handoffProgress = 0,
	intensity,
	kind,
	progress,
	tint,
}: {
	readonly actor: PixiTileActor;
	readonly handoffProgress?: number;
	readonly intensity: number;
	readonly kind: ParticlePlaybackKind;
	readonly progress: number;
	readonly tint: number;
}) => {
	const effect = actor.activityParticles;
	const burstWindow = 0.64;
	const resolvedHandoffProgress = kind === "burst" ? clampUnitFn(handoffProgress) : 0;
	const runningHandoffProgress = (progress * 0.32) % 1;
	effect.lastProgress = resolvedHandoffProgress > 0 ? runningHandoffProgress : progress;
	const lightSurface = effect.lightSurface;
	for (const {
		alphaScale,
		particle,
		phaseOffset,
		speedCycles,
		spreadOffset,
		waveOffset,
	} of effect.particles) {
		const burstSpeed = 0.82 + (speedCycles - 1) * 0.18;
		const rawLocalProgress =
			kind === "running"
				? (progress * speedCycles + phaseOffset) % 1
				: (progress * burstSpeed - phaseOffset * (1 - burstWindow)) / burstWindow;
		const localProgress = clampUnitFn(rawLocalProgress);
		const visible = rawLocalProgress >= 0 && rawLocalProgress <= 1;
		const riseProgress = easeOutCubicFn(localProgress);
		const spreadProgress = localProgress ** 0.82;
		const plumeHalfWidth = effect.topHalfWidth * spreadProgress;
		const wave =
			Math.sin(waveOffset + localProgress * twoPi * waveTurns) *
			effect.topHalfWidth *
			0.075 *
			spreadProgress;
		const shimmer =
			(Math.sin(waveOffset * 1.73 + localProgress * twoPi * shimmerTurns) + 1) / 2;
		const x = effect.centerX + spreadOffset * plumeHalfWidth + wave;
		const y = effect.startY + (effect.topY - effect.startY) * riseProgress;
		const particleTint = readShimmerTintFn(tint, shimmer, lightSurface);
		const alpha =
			(visible ? smoothEnvelopeFn(localProgress) : 0) *
			intensity *
			alphaScale *
			(kind === "burst" ? 1 : 0.86) *
			(0.7 + shimmer * 0.3);
		if (resolvedHandoffProgress <= 0) {
			particle.x = x;
			particle.y = y;
			particle.tint = particleTint;
			particle.alpha = alpha;
			continue;
		}

		const runningLocalProgress = (runningHandoffProgress * speedCycles + phaseOffset) % 1;
		const runningRiseProgress = easeOutCubicFn(runningLocalProgress);
		const runningSpreadProgress = runningLocalProgress ** 0.82;
		const runningPlumeHalfWidth = effect.topHalfWidth * runningSpreadProgress;
		const runningWave =
			Math.sin(waveOffset + runningLocalProgress * twoPi * waveTurns) *
			effect.topHalfWidth *
			0.075 *
			runningSpreadProgress;
		const runningShimmer =
			(Math.sin(waveOffset * 1.73 + runningLocalProgress * twoPi * shimmerTurns) + 1) / 2;
		const runningX = effect.centerX + spreadOffset * runningPlumeHalfWidth + runningWave;
		const runningY = effect.startY + (effect.topY - effect.startY) * runningRiseProgress;
		const runningTint = readShimmerTintFn(effect.workingTint, runningShimmer, lightSurface);
		const runningAlpha =
			smoothEnvelopeFn(runningLocalProgress) *
			alphaScale *
			0.86 *
			(0.7 + runningShimmer * 0.3);
		particle.x = mixFn(x, runningX, resolvedHandoffProgress);
		particle.y = mixFn(y, runningY, resolvedHandoffProgress);
		particle.tint = mixTintFn(particleTint, runningTint, resolvedHandoffProgress);
		particle.alpha = mixFn(alpha, runningAlpha, resolvedHandoffProgress);
	}
};

export namespace runActivityParticlesFx {
	export type Action =
		| (ActivityParticlesProps & {
				readonly kind: "start";
		  })
		| (ActivityParticlesProps & {
				readonly kind: "stop";
		  })
		| (ActivityParticlesProps & {
				readonly kind: "feedback";
				readonly tint?: number;
		  });
}

/** Owns the actor-local particle playback channel for working state and semantic feedback. */
export const runActivityParticlesFx = Effect.fnUntraced(function* (
	action: runActivityParticlesFx.Action,
) {
	const { actor, animator } = action;
	const effect = actor.activityParticles;
	const animationKey = readActivityAnimationKeyFn(actor);

	switch (action.kind) {
		case "start": {
			if (actor.container.destroyed || effect.feedbackPhase === "burst") return;
			yield* animator.cancelFx(animationKey);
			effect.feedbackPhase = null;
			const wasVisible = effect.container.visible;
			yield* animator.setFx({
				actor,
				channel: "activity-particles",
				reset: !wasVisible,
				visible: true,
			});
			const fromProgress = wasVisible ? effect.lastProgress % 1 : 0;
			const rampIn = action.rampIn ?? !wasVisible;
			const rampProgress = runningRampDurationMs / runningCycleDurationMs;
			let rampComplete = !rampIn;
			let previousTweenProgress = 0;
			yield* animator.animateFx({
				actor,
				channel: "activity-particles",
				curve: {
					kind: "linear",
				},
				durationMs: runningCycleDurationMs,
				ownerKey: animationKey,
				repeat: Number.POSITIVE_INFINITY,
				renderFn: (progress) => {
					if (
						!rampComplete &&
						(progress >= rampProgress || progress < previousTweenProgress)
					) {
						rampComplete = true;
					}
					const cycleProgress = (fromProgress + progress) % 1;
					renderParticlesFn({
						actor,
						intensity: rampComplete ? 1 : clampUnitFn(progress / rampProgress),
						kind: "running",
						progress: cycleProgress,
						tint: effect.workingTint,
					});
					previousTweenProgress = progress;
				},
			});
			return;
		}
		case "stop": {
			if (actor.container.destroyed || effect.feedbackPhase === "burst") return;
			yield* animator.cancelFx(animationKey);
			if (!effect.container.visible) {
				effect.feedbackPhase = null;
				return;
			}
			effect.feedbackPhase = "draining";
			const fromProgress = effect.lastProgress;
			yield* animator.animateFx({
				actor,
				channel: "activity-particles",
				durationMs: drainDurationMs,
				ownerKey: animationKey,
				onCompleteFn: () => {
					if (actor.container.destroyed) return;
					if (actor.item.activityEffect) {
						RendererRuntime.runSync(
							runActivityParticlesFx({
								actor,
								animator,
								kind: "start",
								rampIn: true,
							}),
						);
						return;
					}
					effect.feedbackPhase = null;
					RendererRuntime.runSync(
						animator.setFx({
							actor,
							channel: "activity-particles",
							visible: false,
						}),
					);
				},
				renderFn: (progress) => {
					renderParticlesFn({
						actor,
						intensity: 1 - progress,
						kind: "running",
						progress: (fromProgress + progress * 0.28) % 1,
						tint: effect.workingTint,
					});
				},
			});
			return;
		}
		case "feedback": {
			if (actor.container.destroyed) return;
			yield* animator.cancelFx(animationKey);
			effect.feedbackPhase = "burst";
			yield* animator.setFx({
				actor,
				channel: "activity-particles",
				reset: true,
				visible: true,
			});
			let handoffStartProgress: number | null = null;
			let handoffCompleted = false;
			yield* animator.animateFx({
				actor,
				channel: "activity-particles",
				durationMs: feedbackDurationMs,
				ownerKey: animationKey,
				onCompleteFn: () => {
					if (actor.container.destroyed) return;
					effect.feedbackPhase = null;
					if (actor.item.activityEffect) {
						RendererRuntime.runSync(
							runActivityParticlesFx({
								actor,
								animator,
								kind: "start",
								rampIn: !handoffCompleted,
							}),
						);
						return;
					}
					RendererRuntime.runSync(
						animator.setFx({
							actor,
							channel: "activity-particles",
							visible: false,
						}),
					);
				},
				renderFn: (progress) => {
					if (!actor.item.activityEffect) {
						handoffStartProgress = null;
						handoffCompleted = false;
					} else if (handoffStartProgress === null) {
						handoffStartProgress = Math.max(0.58, progress);
					}
					const handoffProgress =
						handoffStartProgress === null || handoffStartProgress >= 1
							? 0
							: smoothStepFn(
									(progress - handoffStartProgress) / (1 - handoffStartProgress),
								);
					if (handoffProgress >= 0.98) handoffCompleted = true;
					renderParticlesFn({
						actor,
						handoffProgress,
						intensity: 1,
						kind: "burst",
						progress,
						tint: action.tint ?? effect.workingTint,
					});
				},
			});
		}
	}
});
