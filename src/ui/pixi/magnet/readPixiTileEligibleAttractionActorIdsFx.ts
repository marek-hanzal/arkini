import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";

export namespace readPixiTileEligibleAttractionActorIdsFx {
	export interface Props {
		readonly game: GameEngine;
		readonly sourceItem: TileActorItem;
		readonly targetItems: ReadonlyArray<TileActorItem>;
	}
}

/** Reads engine-confirmed combine responders without inferring compatibility in the renderer. */
export const readPixiTileEligibleAttractionActorIdsFx = Effect.fn(
	"readPixiTileEligibleAttractionActorIdsFx",
)(function* ({ game, sourceItem, targetItems }: readPixiTileEligibleAttractionActorIdsFx.Props) {
	const actorIds = new Set<string>();
	for (const targetItem of targetItems) {
		if (targetItem.id === sourceItem.id) continue;
		const preview = yield* readTileDropPreviewFx({
			game,
			sourceItemId: sourceItem.id,
			sourceLocation: sourceItem.location,
			sourceRevision: sourceItem.revision,
			target: {
				kind: "slot",
				location: targetItem.location,
				occupant: {
					itemId: targetItem.id,
					revision: targetItem.revision,
				},
			},
		});
		const actorId = yield* readPixiTileAttractionActorIdFx({
			previewKind: preview.kind,
			targetItem,
		});
		if (actorId !== null) actorIds.add(actorId);
	}
	return actorIds as ReadonlySet<string>;
});
