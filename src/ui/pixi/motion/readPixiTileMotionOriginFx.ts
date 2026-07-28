import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace readPixiTileMotionOriginFx {
	export interface Props {
		readonly originActor: PixiTileActor | null;
		readonly originLocation: TileActorItem["location"];
		readonly surface: PixiMainSceneSurface;
	}

	export type Result = PixiTileActorPose | null;
}

/** Resolves one cue origin from its live actor or the scene's semantic location. */
export const readPixiTileMotionOriginFx = Effect.fn("readPixiTileMotionOriginFx")(function* ({
	originActor,
	originLocation,
	surface,
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
	return yield* surface.readLocationPoseFx(originLocation);
});
