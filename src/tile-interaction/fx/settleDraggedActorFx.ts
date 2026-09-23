import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { animateRetargetablePoseFx } from "~/tile-rendering/fx/animateRetargetablePoseFx";
import { readSettleDurationMsFn } from "~/tile-interaction/fn/readSettleDurationMsFn";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";

interface Props {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly onCompleteFn?: () => void;
	readonly surface: MainInteractionSurface;
}

/** Returns one released actor to its latest canonical pose and interaction state. */
export const settleDraggedActorFx = Effect.fn("settleDraggedActorFx")(function* ({
	actor,
	animator,
	onCompleteFn,
	surface,
}: Props) {
	actor.dragging = false;
	const pose = yield* surface.readActorPoseFx(actor.item);
	if (pose === null || actor.container.destroyed) {
		onCompleteFn?.();
		return;
	}
	surface.transientActorLayer.addChild(actor.container);
	actor.container.zIndex = 0;
	actor.container.cursor = readActorCursorFn({
		phase: "idle",
		running: actor.item.running,
	});
	const durationMs = readSettleDurationMsFn({
		fromX: actor.container.x,
		fromY: actor.container.y,
		tileSize: pose.size,
		toX: pose.x,
		toY: pose.y,
	});
	const readTargetFn = () => RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ?? pose;
	yield* animateRetargetablePoseFx({
		actor,
		animator,
		target: pose,
		readTargetFn,
		readSizeFn: () => readTargetFn().size,
		curve: {
			bounce: 0.14,
			kind: "spring",
		},
		durationMs,
		onCompleteFn: () => {
			if (!actor.container.destroyed) {
				const latest = RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ?? pose;
				latest.layer.addChild(actor.container);
			}
			onCompleteFn?.();
		},
	});
});
