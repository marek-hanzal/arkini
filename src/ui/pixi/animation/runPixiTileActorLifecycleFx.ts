import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { whenPixiTileActorVisualReadyFx } from "~/ui/pixi/actor/PixiTileActorVisualReadiness";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

export const pixiTileActorLifecycleDurationMs = 260;
export const pixiTileActorLifecycleReducedScale = 0.8;

const animateLifecycleFx = Effect.fn("animatePixiTileActorLifecycleFx")(function* ({
	actor,
	animator,
	delayMs = 0,
	durationMs,
	onCancel,
	onComplete,
	toAlpha,
	toScale,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly delayMs?: number;
	readonly durationMs: number;
	readonly onCancel?: () => void;
	readonly onComplete?: () => void;
	readonly toAlpha: number;
	readonly toScale: number;
}) {
	if (actor.container.destroyed) return;
	// Register scale first so the opacity completion observes the same final lifecycle frame.
	yield* animator.animateFx({
		actor,
		channel: "lifecycle-scale",
		delayMs,
		durationMs,
		toScale,
	});
	yield* animator.animateFx({
		actor,
		channel: "lifecycle-opacity",
		delayMs,
		durationMs,
		onCancel,
		onComplete,
		toAlpha,
	});
});

/** Places one new actor on the shared hidden/reduced first frame before its entrance owner starts. */
export const preparePixiTileActorEnterFx = Effect.fn("preparePixiTileActorEnterFx")(
	({
		actor,
		animator,
	}: {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}) =>
		Effect.gen(function* () {
			if (actor.container.destroyed) return;
			yield* animator.setFx({
				actor,
				channel: "lifecycle-scale",
				scale: pixiTileActorLifecycleReducedScale,
			});
			yield* animator.setFx({
				actor,
				alpha: 0,
				channel: "lifecycle-opacity",
			});
		}),
);

/** Resumes a pending semantic entrance once one complete visual revision is renderable. */
export const resumePixiTileActorEnterFx = Effect.fn("resumePixiTileActorEnterFx")(
	({
		actor,
		animator,
	}: {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}) =>
		Effect.sync(() => {
			if (
				actor.container.destroyed ||
				actor.lifecycleTargetAlpha !== 1 ||
				actor.lifecycleTransitionStarted
			) {
				return;
			}
			const intentGeneration = actor.lifecycleIntentGeneration;
			const startEnter = () => {
				if (
					actor.container.destroyed ||
					actor.lifecycleIntentGeneration !== intentGeneration ||
					actor.lifecycleTargetAlpha !== 1 ||
					actor.lifecycleTransitionStarted
				) {
					return;
				}
				actor.lifecycleTransitionStarted = true;
				RendererRuntime.runSync(
					animateLifecycleFx({
						actor,
						animator,
						delayMs: Math.max(0, actor.lifecycleNotBeforeMs - performance.now()),
						durationMs: actor.lifecycleDurationMs,
						toAlpha: 1,
						toScale: 1,
					}),
				);
			};
			for (const visual of actor.visuals) {
				RendererRuntime.runSync(
					whenPixiTileActorVisualReadyFx({
						visual,
						onReady: startEnter,
					}),
				);
			}
		}),
);

/** Starts one semantic entrance from the shared hidden/reduced lifecycle pose. */
export const startPixiTileActorEnterFx = Effect.fn("startPixiTileActorEnterFx")(function* ({
	actor,
	animator,
	delayMs = 0,
	durationMs = pixiTileActorLifecycleDurationMs,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly delayMs?: number;
	readonly durationMs?: number;
}) {
	if (actor.container.destroyed) return;
	actor.lifecycleIntentGeneration += 1;
	actor.lifecycleTargetAlpha = 1;
	actor.lifecycleTransitionStarted = false;
	actor.lifecycleNotBeforeMs = performance.now() + delayMs;
	actor.lifecycleDurationMs = durationMs;
	yield* preparePixiTileActorEnterFx({
		actor,
		animator,
	});
	yield* resumePixiTileActorEnterFx({
		actor,
		animator,
	});
});

/** Starts one semantic exit toward the exact mirrored hidden/reduced lifecycle pose. */
export const startPixiTileActorExitFx = Effect.fn("startPixiTileActorExitFx")(function* ({
	actor,
	animator,
	durationMs = pixiTileActorLifecycleDurationMs,
	onCancel,
	onComplete,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly durationMs?: number;
	readonly onCancel?: () => void;
	readonly onComplete?: () => void;
}) {
	if (actor.container.destroyed) return;
	actor.lifecycleIntentGeneration += 1;
	actor.lifecycleTargetAlpha = 0;
	actor.lifecycleTransitionStarted = true;
	actor.lifecycleNotBeforeMs = performance.now();
	actor.lifecycleDurationMs = durationMs;
	yield* animateLifecycleFx({
		actor,
		animator,
		durationMs,
		onCancel,
		onComplete,
		toAlpha: 0,
		toScale: pixiTileActorLifecycleReducedScale,
	});
});

/** Restores one interrupted optimistic exit from its exact current alpha and lifecycle scale. */
export const restorePixiTileActorExitFx = Effect.fn("restorePixiTileActorExitFx")(function* ({
	actor,
	animator,
	durationMs = pixiTileActorLifecycleDurationMs,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly durationMs?: number;
}) {
	if (actor.container.destroyed) return;
	actor.lifecycleIntentGeneration += 1;
	actor.lifecycleTargetAlpha = 1;
	actor.lifecycleTransitionStarted = true;
	actor.lifecycleNotBeforeMs = performance.now();
	actor.lifecycleDurationMs = durationMs;
	yield* animateLifecycleFx({
		actor,
		animator,
		durationMs,
		toAlpha: 1,
		toScale: 1,
	});
});
