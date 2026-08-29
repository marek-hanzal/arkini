import { Effect } from "effect";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { MagneticField } from "~/ui/pixi/magnet/MagneticField";
import { readAttractionActorIdFn } from "~/ui/pixi/magnet/fn/readAttractionActorIdFn";

export namespace updateMagneticFieldFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly eligibleAttractionActorIds: ReadonlySet<string>;
		readonly field: MagneticField;
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
export const updateMagneticFieldFx = Effect.fn("updateMagneticFieldFx")(function* ({
	actor,
	candidateActorIds,
	eligibleAttractionActorIds,
	field,
	previewKind,
	sourceDirection,
	sourceItem,
	targetItem,
}: updateMagneticFieldFx.Props) {
	const attractedActorId = readAttractionActorIdFn({
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
});
