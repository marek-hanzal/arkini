import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export namespace readMotionOriginFx {
	export interface Props {
		readonly originActor: PixiTileActor | null;
		readonly originLocation: TileActorItem["location"];
		readonly surface: MainSurface;
	}

	export type Result = ActorPose | null;
}

/** Resolves one cue origin from its live actor or the scene's semantic location. */
export const readMotionOriginFx = Effect.fn("readMotionOriginFx")(function* ({
	originActor,
	originLocation,
	surface,
}: readMotionOriginFx.Props) {
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
		} satisfies readMotionOriginFx.Result;
	}
	return yield* surface.readLocationPoseFx(originLocation);
});
