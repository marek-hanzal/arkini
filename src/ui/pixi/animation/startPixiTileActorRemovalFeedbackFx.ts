import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiActorAlphaAnimationKey } from "~/ui/pixi/animation/readPixiActorAlphaAnimationKey";

export namespace startPixiTileActorRemovalFeedbackFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly onCancel?: () => void;
		readonly onComplete?: () => void;
	}
}

export const pixiTileActorRemovalFeedbackDurationMs = 260;
export const pixiTileActorRemovalRestoreDurationMs = 160;

/**
 * Starts one interruptible optimistic exit without changing canonical actor ownership.
 *
 * Reconciliation may adopt the live alpha and destroy an accepted removal. A rejected command may
 * restore only the exact actor instance and lifecycle generation that still owns this intent.
 */
export const startPixiTileActorRemovalFeedbackFx = Effect.fn("startPixiTileActorRemovalFeedbackFx")(
	function* ({
		actor,
		animator,
		onCancel,
		onComplete,
	}: startPixiTileActorRemovalFeedbackFx.Props) {
		if (actor.container.destroyed) return;
		actor.lifecycleIntentGeneration += 1;
		actor.lifecycleTargetAlpha = 0;
		actor.lifecycleFadeStarted = true;
		actor.lifecycleNotBeforeMs = performance.now();
		actor.lifecycleDurationMs = pixiTileActorRemovalFeedbackDurationMs;
		yield* animator.animateFx({
			actor,
			channel: "lifecycle-opacity",
			durationMs: pixiTileActorRemovalFeedbackDurationMs,
			onCancel,
			onComplete,
			ownerKey: readPixiActorAlphaAnimationKey(actor),
			toAlpha: 0,
		});
	},
);

/** Restores an optimistic exit when the canonical command rejected the removal. */
export const restorePixiTileActorRemovalFeedbackFx = Effect.fn(
	"restorePixiTileActorRemovalFeedbackFx",
)(function* ({ actor, animator }: Omit<startPixiTileActorRemovalFeedbackFx.Props, "onComplete">) {
	if (actor.container.destroyed) return;
	actor.lifecycleIntentGeneration += 1;
	actor.lifecycleTargetAlpha = 1;
	actor.lifecycleFadeStarted = true;
	actor.lifecycleNotBeforeMs = performance.now();
	actor.lifecycleDurationMs = pixiTileActorRemovalRestoreDurationMs;
	yield* animator.animateFx({
		actor,
		channel: "lifecycle-opacity",
		durationMs: pixiTileActorRemovalRestoreDurationMs,
		ownerKey: readPixiActorAlphaAnimationKey(actor),
		toAlpha: 1,
	});
});
