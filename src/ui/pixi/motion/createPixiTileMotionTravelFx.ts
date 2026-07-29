import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { createPixiTileMotionPoseSamplerFx } from "~/ui/pixi/motion/createPixiTileMotionPoseSamplerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

/** Creates the geometry sampler and no-target magnetic projection shared by free tile travel. */
export const createPixiTileMotionTravelFx = Effect.fn("createPixiTileMotionTravelFx")(function* ({
	actor,
	magneticField,
	surface,
	target,
	targetFootprint,
	targetLocation,
}: {
	readonly actor: PixiTileActor;
	readonly magneticField: PixiTileMagneticField;
	readonly surface: PixiMainSceneSurface;
	readonly target: PixiTileActorPose;
	readonly targetFootprint: TileActorItem["footprint"];
	readonly targetLocation: TileActorItem["location"];
}) {
	return {
		poseSampler: yield* createPixiTileMotionPoseSamplerFx({
			actorBaseHeight: actor.height || actor.size,
			actorBaseWidth: actor.width || actor.size,
			from: {
				scaleX: actor.container.scale.x,
				scaleY: actor.container.scale.y,
				x: actor.container.x,
				y: actor.container.y,
			},
			surface,
			target,
			targetFootprint,
			targetLocation,
		}),
		magneticProjector: yield* createPixiTileMotionMagneticProjectorFx({
			actor,
			attractedActorId: null,
			eligibleAttractionActorIds: new Set(),
			magneticField,
		}),
	};
});
