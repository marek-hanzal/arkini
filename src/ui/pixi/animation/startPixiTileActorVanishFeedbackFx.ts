import { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import {
	pixiTileActorRemovalFeedbackDurationMs,
	startPixiTileActorRemovalFeedbackFx,
} from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";

const pixiTileActorVanishScale = 0.72;

/**
 * Fades and shrinks one transient around its displayed center before final destruction.
 *
 * Pose is registered first so the opacity completion callback observes the same final tween frame.
 */
export const startPixiTileActorVanishFeedbackFx = Effect.fn("startPixiTileActorVanishFeedbackFx")(
	function* ({
		actor,
		animator,
		onCancel,
		onComplete,
	}: {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly onCancel?: () => void;
		readonly onComplete: () => void;
	}) {
		if (actor.container.destroyed) return;
		const fromScale = actor.container.scale.x;
		const toScale = fromScale * pixiTileActorVanishScale;
		const scaleDelta = fromScale - toScale;
		yield* animator.animateFx({
			actor,
			channel: "pose",
			durationMs: pixiTileActorRemovalFeedbackDurationMs,
			toScale,
			toX: actor.container.x + (actor.size / 2 - actor.container.pivot.x) * scaleDelta,
			toY: actor.container.y + (actor.size / 2 - actor.container.pivot.y) * scaleDelta,
		});
		yield* startPixiTileActorRemovalFeedbackFx({
			actor,
			animator,
			onCancel,
			onComplete,
		});
	},
);
