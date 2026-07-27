import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiActorAlphaAnimationKey } from "~/ui/pixi/animation/readPixiActorAlphaAnimationKey";

export namespace flashPixiTileActorConsumedSourceFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}

export const pixiTileActorConsumedSourceFadeDurationMs = 130;
const pixiTileActorConsumedSourceRestoreDurationMs = 360;
const consumedSourceAlpha = 0.42;

/**
 * Dips a surviving consumed source, then restores it through the same instance-scoped lifecycle
 * channel. A later exit or newer consumption supersedes both legs without a stale restore.
 */
export const flashPixiTileActorConsumedSourceFx = Effect.fn("flashPixiTileActorConsumedSourceFx")(
	function* ({ actor, animator }: flashPixiTileActorConsumedSourceFx.Props) {
		if (actor.container.destroyed) return;
		actor.lifecycleIntentGeneration += 1;
		const intentGeneration = actor.lifecycleIntentGeneration;
		actor.lifecycleTargetAlpha = 1;
		actor.lifecycleFadeStarted = true;
		yield* animator.animateFx({
			actor,
			channel: "lifecycle-opacity",
			durationMs: pixiTileActorConsumedSourceFadeDurationMs,
			ownerKey: readPixiActorAlphaAnimationKey(actor),
			onComplete: () => {
				if (
					actor.container.destroyed ||
					actor.lifecycleIntentGeneration !== intentGeneration ||
					actor.lifecycleTargetAlpha !== 1
				) {
					return;
				}
				RendererRuntime.runSync(
					animator.animateFx({
						actor,
						channel: "lifecycle-opacity",
						durationMs: pixiTileActorConsumedSourceRestoreDurationMs,
						ownerKey: readPixiActorAlphaAnimationKey(actor),
						toAlpha: 1,
					}),
				);
			},
			toAlpha: consumedSourceAlpha,
		});
	},
);
