import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";

const remainderFadeOutDurationMs = 275;
const remainderFadeInDurationMs = 375;

/**
 * Hides a delivered stack, lets canonical remainder presentation change at alpha zero, then
 * reveals it. The caller may start independent return travel when reveal begins.
 */
export const startRemainderFeedbackFx = Effect.fn("startRemainderFeedbackFx")(function* ({
	actor,
	animator,
	onCancelFn,
	onHiddenFx,
	onRevealedFn,
	onRevealStartedFn,
	shouldRevealFn,
	ownerKey,
}: {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly onCancelFn?: () => void;
	readonly onHiddenFx: Effect.Effect<void, never, never>;
	readonly onRevealedFn: () => void;
	readonly onRevealStartedFn?: () => void;
	readonly shouldRevealFn?: () => boolean;
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
					if (actor.container.destroyed || shouldRevealFn?.() === false) return;
					yield* animator.animateFx({
						actor,
						channel: "lifecycle-opacity",
						durationMs: remainderFadeInDurationMs,
						ownerKey,
						onCancelFn,
						onCompleteFn: onRevealedFn,
						toAlpha: 1,
					});
					onRevealStartedFn?.();
				}),
			);
		},
		toAlpha: 0,
	});
});
