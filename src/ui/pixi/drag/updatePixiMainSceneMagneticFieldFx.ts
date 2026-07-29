import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";

export namespace updatePixiMainSceneMagneticFieldFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly eligibleAttractionActorIds: ReadonlySet<string>;
		readonly field: PixiTileMagneticField;
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly sourceDirection: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly sourceItem: TileActorItem;
		readonly targetItem: TileActorItem | null;
	}
}

/** Projects one drag snapshot into the magnetic presentation owner. */
export const updatePixiMainSceneMagneticFieldFx = Effect.fn("updatePixiMainSceneMagneticFieldFx")(
	function* ({
		actor,
		candidateActorIds,
		eligibleAttractionActorIds,
		field,
		previewKind,
		sourceDirection,
		sourceItem,
		targetItem,
	}: updatePixiMainSceneMagneticFieldFx.Props) {
		const attractedActorId = yield* readPixiTileAttractionActorIdFx({
			previewKind,
			targetItem,
		});
		yield* field.updateFx({
			attractedActorId,
			candidateActorIds,
			eligibleAttractionActorIds,
			sourceActorId: sourceItem.id,
			sourceInstanceId: actor.instanceId,
			sourceDirection,
			sourceX: actor.container.x - actor.container.pivot.x * actor.container.scale.x,
			sourceY: actor.container.y - actor.container.pivot.y * actor.container.scale.y,
		});
	},
);
