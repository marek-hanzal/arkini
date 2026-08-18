import { Effect } from "effect";

import { removeDraggedCheatItemFx } from "~/bridge/cheat/removeDraggedCheatItemFx";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export namespace removePixiMainSceneDraggedCheatItemFx {
	export interface Props {
		readonly game: GameEngine;
		readonly sourceItem: TileActorItem;
	}
}

/** Removes one already-rebased dragged item through the cheat-authorized engine command. */
export const removePixiMainSceneDraggedCheatItemFx = Effect.fn(
	"removePixiMainSceneDraggedCheatItemFx",
)(({ game, sourceItem }: removePixiMainSceneDraggedCheatItemFx.Props) =>
	removeDraggedCheatItemFx({
		game,
		itemId: sourceItem.id,
		revision: sourceItem.revision,
	}),
);
