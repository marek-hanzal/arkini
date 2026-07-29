import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiRectangularRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createPixiRectangularRetargetablePoseSamplerFx";
import { readPixiDragSettleDurationMsFx } from "~/ui/pixi/drag/readPixiDragSettleDurationMsFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace settlePixiMainSceneDraggedActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly surface: PixiMainSceneSurface;
	}
}

/** Returns one released actor to its latest canonical pose and interaction state. */
export const settlePixiMainSceneDraggedActorFx = Effect.fn("settlePixiMainSceneDraggedActorFx")(
	function* ({ actor, animator, surface }: settlePixiMainSceneDraggedActorFx.Props) {
		const pose = yield* surface.readActorPoseFx(actor.item);
		if (pose === null || actor.container.destroyed) return;
		surface.transientActorLayer.addChild(actor.container);
		actor.dragging = false;
		actor.container.zIndex = 0;
		actor.container.cursor = yield* readPixiTileActorCursorFx({
			phase: "idle",
			previewKind: null,
			running: actor.item.running,
		});
		const durationMs = yield* readPixiDragSettleDurationMsFx({
			fromX: actor.container.x,
			fromY: actor.container.y,
			tileSize: pose.size,
			toX: pose.x,
			toY: pose.y,
		});
		const readPose = yield* createPixiRectangularRetargetablePoseSamplerFx({
			from: {
				scaleX: actor.container.scale.x,
				scaleY: actor.container.scale.y,
				x: actor.container.x,
				y: actor.container.y,
			},
			readTarget: () => {
				const latest = RendererRuntime.runSync(surface.readActorPoseFx(actor.item)) ?? pose;
				return {
					scaleX: latest.width / Math.max(1, actor.width),
					scaleY: latest.height / Math.max(1, actor.height),
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
	},
);
