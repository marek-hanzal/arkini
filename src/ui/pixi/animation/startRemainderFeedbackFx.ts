import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

const remainderFadeOutDurationMs = 275;
const remainderFadeInDurationMs = 375;

/**
 * Hides a delivered stack, lets canonical remainder presentation change at alpha zero, then
 * reveals it before the caller starts its return journey.
 */
export const startRemainderFeedbackFx = Effect.fn("startRemainderFeedbackFx")(function* ({
	actor,
	animator,
	onCancel,
	onHiddenFx,
	onRevealed,
	ownerKey,
}: {
	readonly actor: PixiTileActor;
	readonly animator: PixiActorAnimator;
	readonly onCancel?: () => void;
	readonly onHiddenFx: Effect.Effect<void>;
	readonly onRevealed: () => void;
	readonly ownerKey: string;
}) {
	yield* animator.animateFx({
		actor,
		channel: "lifecycle-opacity",
		durationMs: remainderFadeOutDurationMs,
		ownerKey,
		onCancel,
		onComplete: () => {
			if (actor.container.destroyed) return;
			RendererRuntime.runSync(
				Effect.gen(function* () {
					yield* onHiddenFx;
					yield* animator.animateFx({
						actor,
						channel: "lifecycle-opacity",
						durationMs: remainderFadeInDurationMs,
						ownerKey,
						onCancel,
						onComplete: onRevealed,
						toAlpha: 1,
					});
				}),
			);
		},
		toAlpha: 0,
	});
});
