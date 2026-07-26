import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";
import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";

export namespace readPixiTileMotionOriginFx {
	export interface Props {
		readonly application: PixiApplicationOwner;
		readonly handoff: TileSceneHandoff | null;
		readonly originActor: PixiTileActor | null;
		readonly originLocation: TileActorItem["location"];
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose | null;
	}

	export type Result = PixiTileActorPose | null;
}

/** Resolves one cue origin from the scene, falling back to a claimed cross-surface handoff. */
export const readPixiTileMotionOriginFx = Effect.fn("readPixiTileMotionOriginFx")(function* ({
	application,
	handoff,
	originActor,
	originLocation,
	surface,
	target,
}: readPixiTileMotionOriginFx.Props) {
	if (originActor !== null && !originActor.container.destroyed) {
		const scale = originActor.container.scale.x;
		return {
			layer: originActor.container.parent ?? surface.transientActorLayer,
			size: originActor.size * scale,
			x:
				originActor.container.x -
				originActor.container.pivot.x * scale +
				originActor.offsetLayer.x * scale,
			y:
				originActor.container.y -
				originActor.container.pivot.y * scale +
				originActor.offsetLayer.y * scale,
		} satisfies readPixiTileMotionOriginFx.Result;
	}
	const origin = yield* surface.readLocationPoseFx(originLocation);
	if (origin !== null || handoff === null || target === null) return origin;
	const canvasRect = application.app.canvas.getBoundingClientRect();
	return {
		layer: surface.transientActorLayer,
		size: handoff.size,
		x: handoff.centerX - canvasRect.left - handoff.size / 2,
		y: handoff.centerY - canvasRect.top - handoff.size / 2,
	} satisfies readPixiTileMotionOriginFx.Result;
});
