import { Effect } from "effect";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemCount } from "~/board/readBoardItemCount";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export const canRestoreInventoryBackedLayoutItemFx = Effect.fn(
	"canRestoreInventoryBackedLayoutItemFx",
)(function* ({
	config,
	memoryItem,
	nextSave,
}: {
	config: GameConfig;
	memoryItem: BoardMemoryLayoutItem;
	nextSave: GameSave;
}) {
	if (
		yield* readBoardItemAtCellFx({
			save: nextSave,
			x: memoryItem.x,
			y: memoryItem.y,
		})
	) {
		return false;
	}

	const definition = config.items[memoryItem.itemId];
	if (!definition) return false;
	if (
		!isItemStorageAllowed({
			config,
			itemId: memoryItem.itemId,
			location: "board",
		})
	) {
		return false;
	}

	const maxCount = definition.maxCount;
	return (
		maxCount === undefined ||
		readBoardItemCount({
			itemId: memoryItem.itemId,
			save: nextSave,
		}) < maxCount
	);
});
