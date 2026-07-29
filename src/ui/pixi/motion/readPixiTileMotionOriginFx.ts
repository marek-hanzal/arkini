import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace readPixiTileMotionOriginFx {
	export interface Props {
		readonly originActor: PixiTileActor | null;
		readonly footprint?: TileActorItem["footprint"];
		readonly originLocation: TileActorItem["location"];
		readonly surface: PixiMainSceneSurface;
	}

	export type Result = PixiTileActorPose | null;
}

/** Resolves one cue origin from its live actor or the scene's semantic location. */
export const readPixiTileMotionOriginFx = Effect.fn("readPixiTileMotionOriginFx")(function* ({
	originActor,
	footprint,
	originLocation,
	surface,
}: readPixiTileMotionOriginFx.Props) {
	if (originActor !== null && !originActor.container.destroyed) {
		const scaleX = originActor.container.scale.x;
		const scaleY = originActor.container.scale.y;
		const semanticPose =
			footprint === undefined
				? null
				: yield* surface.readLocationPoseFx(originLocation, footprint);
		return {
			layer: originActor.container.parent ?? surface.transientActorLayer,
			height: semanticPose?.height ?? originActor.height * scaleY,
			size: originActor.size * scaleX,
			width: semanticPose?.width ?? originActor.width * scaleX,
			x:
				originActor.container.x -
				originActor.container.pivot.x * scaleX +
				originActor.offsetLayer.x * scaleX,
			y:
				originActor.container.y -
				originActor.container.pivot.y * scaleY +
				originActor.offsetLayer.y * scaleY,
		} satisfies readPixiTileMotionOriginFx.Result;
	}
	return yield* surface.readLocationPoseFx(originLocation, footprint);
});
