import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiRetargetablePoseSamplerFx } from "~/ui/pixi/animation/createPixiRetargetablePoseSamplerFx";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
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
		pose.layer.addChild(actor.container);
		actor.dragging = false;
		actor.container.zIndex = 0;
		actor.container.cursor = yield* readPixiTileActorCursorFx({
			phase: "idle",
			previewKind: null,
			running: actor.item.running,
		});
		const durationMs = yield* readPixiTileTravelDurationMsFx({
			fromX: actor.container.x,
			fromY: actor.container.y,
			tileSize: pose.size,
			toX: pose.x,
			toY: pose.y,
		});
		const readPose = yield* createPixiRetargetablePoseSamplerFx({
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
			durationMs,
			readPose,
		});
	},
);
