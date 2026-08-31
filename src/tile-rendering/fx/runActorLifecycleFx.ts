import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { whenVisualReadyFx } from "~/tile-rendering/fx/whenVisualReadyFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";

export const lifecycleDurationMs = 260;
const lifecycleReducedScale = 0.8;

interface LifecycleProps {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
}

export namespace runActorLifecycleFx {
	export type Action =
		| (LifecycleProps & {
				readonly kind: "prepare-enter";
		  })
		| (LifecycleProps & {
				readonly kind: "resume-enter";
		  })
		| (LifecycleProps & {
				readonly delayMs?: number;
				readonly durationMs?: number;
				readonly kind: "start-enter";
		  })
		| (LifecycleProps & {
				readonly durationMs?: number;
				readonly kind: "start-exit";
				readonly onCancel?: () => void;
				readonly onComplete?: () => void;
		  })
		| (LifecycleProps & {
				readonly durationMs?: number;
				readonly kind: "restore-exit";
		  });
}

/** Owns the actor-local enter/exit state machine and its shared scale/opacity channels. */
export const runActorLifecycleFx = Effect.fn("runActorLifecycleFx")(function* (
	action: runActorLifecycleFx.Action,
) {
	const { actor, animator } = action;
	if (actor.container.destroyed) return;

	const animate = ({
		delayMs = 0,
		durationMs,
		onCancel,
		onComplete,
		toAlpha,
		toScale,
	}: {
		readonly delayMs?: number;
		readonly durationMs: number;
		readonly onCancel?: () => void;
		readonly onComplete?: () => void;
		readonly toAlpha: number;
		readonly toScale: number;
	}): Effect.Effect<void, never, never> =>
		Effect.gen(function* () {
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

	const resumeEnter = () => {
		if (actor.lifecycleTargetAlpha !== 1 || actor.lifecycleTransitionStarted) return;
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
				animate({
					delayMs: Math.max(0, actor.lifecycleNotBeforeMs - performance.now()),
					durationMs: actor.lifecycleDurationMs,
					toAlpha: 1,
					toScale: 1,
				}),
			);
		};
		for (const visual of actor.visuals) {
			RendererRuntime.runSync(
				whenVisualReadyFx({
					visual,
					onReady: startEnter,
				}),
			);
		}
	};

	switch (action.kind) {
		case "prepare-enter": {
			yield* animator.setFx({
				actor,
				channel: "lifecycle-scale",
				scale: lifecycleReducedScale,
			});
			yield* animator.setFx({
				actor,
				alpha: 0,
				channel: "lifecycle-opacity",
			});
			return;
		}
		case "resume-enter": {
			resumeEnter();
			return;
		}
		case "start-enter": {
			const delayMs = action.delayMs ?? 0;
			const durationMs = action.durationMs ?? lifecycleDurationMs;
			actor.lifecycleIntentGeneration += 1;
			actor.lifecycleTargetAlpha = 1;
			actor.lifecycleTransitionStarted = false;
			actor.lifecycleNotBeforeMs = performance.now() + delayMs;
			actor.lifecycleDurationMs = durationMs;
			yield* animator.setFx({
				actor,
				channel: "lifecycle-scale",
				scale: lifecycleReducedScale,
			});
			yield* animator.setFx({
				actor,
				alpha: 0,
				channel: "lifecycle-opacity",
			});
			resumeEnter();
			return;
		}
		case "start-exit": {
			const durationMs = action.durationMs ?? lifecycleDurationMs;
			actor.lifecycleIntentGeneration += 1;
			actor.lifecycleTargetAlpha = 0;
			actor.lifecycleTransitionStarted = true;
			actor.lifecycleNotBeforeMs = performance.now();
			actor.lifecycleDurationMs = durationMs;
			yield* animate({
				durationMs,
				onCancel: action.onCancel,
				onComplete: action.onComplete,
				toAlpha: 0,
				toScale: lifecycleReducedScale,
			});
			return;
		}
		case "restore-exit": {
			const durationMs = action.durationMs ?? lifecycleDurationMs;
			actor.lifecycleIntentGeneration += 1;
			actor.lifecycleTargetAlpha = 1;
			actor.lifecycleTransitionStarted = true;
			actor.lifecycleNotBeforeMs = performance.now();
			actor.lifecycleDurationMs = durationMs;
			yield* animate({
				durationMs,
				toAlpha: 1,
				toScale: 1,
			});
		}
	}
});
