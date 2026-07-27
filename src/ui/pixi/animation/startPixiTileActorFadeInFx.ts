import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { whenPixiTileActorVisualReadyFx } from "~/ui/pixi/actor/PixiTileActorVisualReadiness";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiActorAlphaAnimationKey } from "~/ui/pixi/animation/readPixiActorAlphaAnimationKey";

export namespace startPixiTileActorFadeInFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly delayMs?: number;
		readonly durationMs?: number;
	}
}

const pixiTileActorFadeInDurationMs = 520;

/**
 * Reattaches one durable lifecycle intent to every surviving visual revision.
 *
 * Texture supersession may replace a private visual slot, but it can never discard the canonical
 * actor's requirement to become visible.
 */
export const resumePixiTileActorFadeInFx = Effect.fn("resumePixiTileActorFadeInFx")(
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
				actor.lifecycleFadeStarted
			) {
				return;
			}
			const intentGeneration = actor.lifecycleIntentGeneration;
			const startFade = () => {
				if (
					actor.container.destroyed ||
					actor.lifecycleIntentGeneration !== intentGeneration ||
					actor.lifecycleTargetAlpha !== 1 ||
					actor.lifecycleFadeStarted
				) {
					return;
				}
				actor.lifecycleFadeStarted = true;
				RendererRuntime.runSync(
					animator.animateFx({
						actor,
						channel: "lifecycle-opacity",
						delayMs: Math.max(0, actor.lifecycleNotBeforeMs - performance.now()),
						durationMs: actor.lifecycleDurationMs,
						ownerKey: readPixiActorAlphaAnimationKey(actor),
						toAlpha: 1,
					}),
				);
			};
			for (const visual of actor.visuals) {
				RendererRuntime.runSync(
					whenPixiTileActorVisualReadyFx({
						visual,
						onReady: startFade,
					}),
				);
			}
		}),
);

/** Records one actor-lifecycle fade intent against the shared presentation clock. */
export const startPixiTileActorFadeInFx = Effect.fn("startPixiTileActorFadeInFx")(function* ({
	actor,
	animator,
	delayMs = 0,
	durationMs = pixiTileActorFadeInDurationMs,
}: startPixiTileActorFadeInFx.Props) {
	actor.lifecycleIntentGeneration += 1;
	actor.lifecycleTargetAlpha = 1;
	actor.lifecycleFadeStarted = false;
	actor.lifecycleNotBeforeMs = performance.now() + delayMs;
	actor.lifecycleDurationMs = durationMs;
	yield* resumePixiTileActorFadeInFx({
		actor,
		animator,
	});
});
