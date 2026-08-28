import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

export namespace flashConsumedSourceFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}

export const pixiTileActorConsumedSourceFadeDurationMs = 130;
const pixiTileActorConsumedSourceRestoreDurationMs = 360;
const consumedSourceAlpha = 0.42;
const readActorAlphaAnimationKey = (actor: Pick<PixiTileActor, "instanceId">) =>
	`actor-alpha:${actor.instanceId}`;

/**
 * Dips a surviving consumed source, then restores it through the same instance-scoped lifecycle
 * channel. A later exit or newer consumption supersedes both legs without a stale restore.
 */
export const flashConsumedSourceFx = Effect.fn("flashConsumedSourceFx")(function* ({
	actor,
	animator,
}: flashConsumedSourceFx.Props) {
	if (actor.container.destroyed) return;
	const intentGeneration = actor.lifecycleIntentGeneration;
	yield* animator.animateFx({
		actor,
		channel: "lifecycle-opacity",
		durationMs: pixiTileActorConsumedSourceFadeDurationMs,
		ownerKey: readActorAlphaAnimationKey(actor),
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
					ownerKey: readActorAlphaAnimationKey(actor),
					toAlpha: 1,
				}),
			);
		},
		toAlpha: consumedSourceAlpha,
	});
});
