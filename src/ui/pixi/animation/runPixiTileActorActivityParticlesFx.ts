import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

export namespace runPixiTileActorActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly rampIn?: boolean;
	}
}

export namespace burstPixiTileActorFeedbackParticlesFx {
	export interface Props extends runPixiTileActorActivityParticlesFx.Props {
		readonly tint?: number;
	}
}

export namespace burstPixiTileActorAckParticlesFx {
	export interface Props extends runPixiTileActorActivityParticlesFx.Props {
		readonly tint: number;
	}
}

type ParticlePlaybackKind = "burst" | "running";

const runningCycleDurationMs = 1_760;
const runningRampDurationMs = 520;
const drainDurationMs = 460;
export const pixiTileActorFeedbackParticlesDurationMs = 720;
const waveTurns = 1.15;
const shimmerTurns = 2.35;
const twoPi = Math.PI * 2;

export const readPixiTileActorActivityParticlesAnimationKey = (actor: PixiTileActor) =>
	`activity-particles:${actor.instanceId}`;

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const smoothEnvelope = (value: number) => Math.sin(Math.PI * clampUnit(value)) ** 1.35;
const smoothStep = (value: number) => {
	const unit = clampUnit(value);
	return unit * unit * (3 - 2 * unit);
};
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

const mixChannel = (channel: number, target: number, amount: number) =>
	Math.round(channel + (target - channel) * amount);
const mixTint = (from: number, to: number, progress: number) => {
	const red = Math.round(mix((from >> 16) & 0xff, (to >> 16) & 0xff, progress));
	const green = Math.round(mix((from >> 8) & 0xff, (to >> 8) & 0xff, progress));
	const blue = Math.round(mix(from & 0xff, to & 0xff, progress));
	return (red << 16) | (green << 8) | blue;
};

/** Preserves the semantic hue while pushing each shimmer toward the contrast side of its surface. */
export const readPixiParticleShimmerTint = (
	tint: number,
	shimmer: number,
	lightSurface: boolean,
) => {
	const unitShimmer = clampUnit(shimmer);
	const amount = lightSurface ? 0.08 + unitShimmer * 0.26 : 0.04 + unitShimmer * 0.34;
	const target = lightSurface ? 0 : 255;
	const red = mixChannel((tint >> 16) & 0xff, target, amount);
	const green = mixChannel((tint >> 8) & 0xff, target, amount);
	const blue = mixChannel(tint & 0xff, target, amount);
	return (red << 16) | (green << 8) | blue;
};

const renderParticles = ({
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
	const resolvedHandoffProgress = kind === "burst" ? clampUnit(handoffProgress) : 0;
	const runningHandoffProgress = (progress * 0.32) % 1;
	effect.lastProgress = resolvedHandoffProgress > 0 ? runningHandoffProgress : progress;
	const lightSurface = effect.container.blendMode === "normal";
	for (const {
		alphaScale,
		particle,
		phaseOffset,
		spreadOffset,
		waveOffset,
	} of effect.particles) {
		const rawLocalProgress =
			kind === "running"
				? (progress + phaseOffset) % 1
				: (progress - phaseOffset * (1 - burstWindow)) / burstWindow;
		const localProgress = clampUnit(rawLocalProgress);
		const visible = rawLocalProgress >= 0 && rawLocalProgress <= 1;
		const riseProgress = easeOutCubic(localProgress);
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
		const particleTint = readPixiParticleShimmerTint(tint, shimmer, lightSurface);
		const alpha =
			(visible ? smoothEnvelope(localProgress) : 0) *
			intensity *
			alphaScale *
			(kind === "burst" ? 0.96 : 0.58) *
			(0.82 + shimmer * 0.18);
		if (resolvedHandoffProgress <= 0) {
			particle.x = x;
			particle.y = y;
			particle.tint = particleTint;
			particle.alpha = alpha;
			continue;
		}

		const runningLocalProgress = (runningHandoffProgress + phaseOffset) % 1;
		const runningRiseProgress = easeOutCubic(runningLocalProgress);
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
		const runningTint = readPixiParticleShimmerTint(
			effect.workingTint,
			runningShimmer,
			lightSurface,
		);
		const runningAlpha =
			smoothEnvelope(runningLocalProgress) *
			alphaScale *
			0.58 *
			(0.82 + runningShimmer * 0.18);
		particle.x = mix(x, runningX, resolvedHandoffProgress);
		particle.y = mix(y, runningY, resolvedHandoffProgress);
		particle.tint = mixTint(particleTint, runningTint, resolvedHandoffProgress);
		particle.alpha = mix(alpha, runningAlpha, resolvedHandoffProgress);
	}
};

const hideParticlesFx = (actor: PixiTileActor, animator: PixiActorAnimator) =>
	animator.setFx({
		actor,
		channel: "activity-particles",
		visible: false,
	});

const runContinuousPlaybackFx = ({
	actor,
	animator,
	fromProgress,
	rampIn,
}: runPixiTileActorActivityParticlesFx.Props & {
	readonly fromProgress: number;
	readonly rampIn: boolean;
}) => {
	const effect = actor.activityParticles;
	const animationKey = readPixiTileActorActivityParticlesAnimationKey(actor);
	const rampProgress = runningRampDurationMs / runningCycleDurationMs;
	let rampComplete = !rampIn;
	let previousTweenProgress = 0;
	return animator.animateFx({
		actor,
		channel: "activity-particles",
		curve: {
			kind: "linear",
		},
		durationMs: runningCycleDurationMs,
		ownerKey: animationKey,
		repeat: Number.POSITIVE_INFINITY,
		render: (progress) => {
			if (!rampComplete && (progress >= rampProgress || progress < previousTweenProgress)) {
				rampComplete = true;
			}
			const cycleProgress = (fromProgress + progress) % 1;
			renderParticles({
				actor,
				intensity: rampComplete ? 1 : clampUnit(progress / rampProgress),
				kind: "running",
				progress: cycleProgress,
				tint: effect.workingTint,
			});
			previousTweenProgress = progress;
		},
	});
};

/** Starts one widening inverted-fire plume on one seamless actor-owned playback channel. */
export const startPixiTileActorActivityParticlesFx = Effect.fn(
	"startPixiTileActorActivityParticlesFx",
)(function* ({ actor, animator, rampIn }: runPixiTileActorActivityParticlesFx.Props) {
	if (actor.container.destroyed) return;
	const effect = actor.activityParticles;
	if (effect.feedbackPhase === "burst") return;
	const animationKey = readPixiTileActorActivityParticlesAnimationKey(actor);
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
	yield* runContinuousPlaybackFx({
		actor,
		animator,
		fromProgress,
		rampIn: rampIn ?? !wasVisible,
	});
});

/** Stops emission, lets the currently distributed pool rise out, then hides the container. */
export const stopPixiTileActorActivityParticlesFx = Effect.fn(
	"stopPixiTileActorActivityParticlesFx",
)(function* ({ actor, animator }: runPixiTileActorActivityParticlesFx.Props) {
	const effect = actor.activityParticles;
	if (actor.container.destroyed || effect.feedbackPhase === "burst") return;
	const animationKey = readPixiTileActorActivityParticlesAnimationKey(actor);
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
		onComplete: () => {
			if (actor.container.destroyed) return;
			if (actor.item.activityEffect) {
				RendererRuntime.runSync(
					startPixiTileActorActivityParticlesFx({
						actor,
						animator,
						rampIn: true,
					}),
				);
				return;
			}
			effect.feedbackPhase = null;
			RendererRuntime.runSync(hideParticlesFx(actor, animator));
		},
		render: (progress) => {
			renderParticles({
				actor,
				intensity: 1 - progress,
				kind: "running",
				progress: (fromProgress + progress * 0.28) % 1,
				tint: effect.workingTint,
			});
		},
	});
});

/**
 * Reuses the actor pool for one dense semantic-feedback burst.
 *
 * A running owner resumes its sparse accent plume after the burst. A neutral actor is hidden, so
 * feedback and working state can never leave competing particle writers behind.
 */
export const burstPixiTileActorFeedbackParticlesFx = Effect.fn(
	"burstPixiTileActorFeedbackParticlesFx",
)(function* ({ actor, animator, tint }: burstPixiTileActorFeedbackParticlesFx.Props) {
	if (actor.container.destroyed) return;
	const effect = actor.activityParticles;
	const animationKey = readPixiTileActorActivityParticlesAnimationKey(actor);
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
		durationMs: pixiTileActorFeedbackParticlesDurationMs,
		ownerKey: animationKey,
		onComplete: () => {
			if (actor.container.destroyed) return;
			effect.feedbackPhase = null;
			if (actor.item.activityEffect) {
				RendererRuntime.runSync(
					startPixiTileActorActivityParticlesFx({
						actor,
						animator,
						rampIn: !handoffCompleted,
					}),
				);
				return;
			}
			RendererRuntime.runSync(hideParticlesFx(actor, animator));
		},
		render: (progress) => {
			if (!actor.item.activityEffect) {
				handoffStartProgress = null;
				handoffCompleted = false;
			} else if (handoffStartProgress === null) {
				handoffStartProgress = Math.max(0.58, progress);
			}
			const handoffProgress =
				handoffStartProgress === null || handoffStartProgress >= 1
					? 0
					: smoothStep((progress - handoffStartProgress) / (1 - handoffStartProgress));
			if (handoffProgress >= 0.98) handoffCompleted = true;
			renderParticles({
				actor,
				handoffProgress,
				intensity: 1,
				kind: "burst",
				progress,
				tint: tint ?? effect.workingTint,
			});
		},
	});
});

/** Uses the semantic success color while sharing feedback ownership with the working plume. */
export const burstPixiTileActorAckParticlesFx = Effect.fn("burstPixiTileActorAckParticlesFx")(
	({ actor, animator, tint }: burstPixiTileActorAckParticlesFx.Props) =>
		burstPixiTileActorFeedbackParticlesFx({
			actor,
			animator,
			tint,
		}),
);
