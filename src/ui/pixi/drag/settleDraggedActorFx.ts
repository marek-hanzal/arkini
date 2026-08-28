import { Effect } from "effect";

import { RendererRuntime } from "~/renderer/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readActorCursorFx } from "~/ui/pixi/actor/readActorCursorFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { createRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createRetargetablePoseSamplerFx";
import { readSettleDurationMsFx } from "~/ui/pixi/drag/readSettleDurationMsFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";

export namespace settleDraggedActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly surface: MainSurface;
	}
}

/** Returns one released actor to its latest canonical pose and interaction state. */
export const settleDraggedActorFx = Effect.fn("settleDraggedActorFx")(function* ({
	actor,
	animator,
	surface,
}: settleDraggedActorFx.Props) {
	const pose = yield* surface.readActorPoseFx(actor.item);
	if (pose === null || actor.container.destroyed) return;
	surface.transientActorLayer.addChild(actor.container);
	actor.dragging = false;
	actor.container.zIndex = 0;
	actor.container.cursor = yield* readActorCursorFx({
		phase: "idle",
		previewKind: null,
		running: actor.item.running,
	});
	const durationMs = yield* readSettleDurationMsFx({
		fromX: actor.container.x,
		fromY: actor.container.y,
		tileSize: pose.size,
		toX: pose.x,
		toY: pose.y,
	});
	const readPose = yield* createRetargetablePoseSamplerFx({
		from: {
			scale: actor.container.scale.x,
			x: actor.container.x,
			y: actor.container.y,
		},
		readTarget: () => {
			const latest = RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ?? pose;
			return {
				scale: latest.size / Math.max(1, actor.size),
				x: latest.x,
				y: latest.y,
			};
		},
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		curve: {
			bounce: 0.14,
			kind: "spring",
		},
		durationMs,
		onComplete: () => {
			if (actor.container.destroyed) return;
			const latest = RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ?? pose;
			latest.layer.addChild(actor.container);
		},
		readPose,
	});
});
