import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";

const remainderFadeOutDurationMs = 275;
const remainderFadeInDurationMs = 375;

/**
 * Hides a delivered stack, lets canonical remainder presentation change at alpha zero, then
 * reveals it before the caller starts its return journey.
 */
export const startRemainderFeedbackFx = Effect.fn("startRemainderFeedbackFx")(function* ({
	actor,
	animator,
	onCancelFn,
	onHiddenFx,
	onRevealedFn,
	ownerKey,
}: {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly onCancelFn?: () => void;
	readonly onHiddenFx: Effect.Effect<void, never, never>;
	readonly onRevealedFn: () => void;
	readonly ownerKey: string;
}) {
	yield* animator.animateFx({
		actor,
		channel: "lifecycle-opacity",
		durationMs: remainderFadeOutDurationMs,
		ownerKey,
		onCancelFn,
		onCompleteFn: () => {
			if (actor.container.destroyed) return;
			RendererRuntime.runSync(
				Effect.gen(function* () {
					yield* onHiddenFx;
					yield* animator.animateFx({
						actor,
						channel: "lifecycle-opacity",
						durationMs: remainderFadeInDurationMs,
						ownerKey,
						onCancelFn,
						onCompleteFn: onRevealedFn,
						toAlpha: 1,
					});
				}),
			);
		},
		toAlpha: 0,
	});
});
