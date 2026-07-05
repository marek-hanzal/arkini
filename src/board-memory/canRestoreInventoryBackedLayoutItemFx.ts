import { Effect } from "effect";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemCount } from "~/board/readBoardItemCount";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";

export const canRestoreInventoryBackedLayoutItemFx = Effect.fn(
	"canRestoreInventoryBackedLayoutItemFx",
)(function* ({
	memoryItem,
	scope,
}: {
	memoryItem: BoardMemoryLayoutItem;
	scope: BoardMemoryActivationScope;
}) {
	const { config, nextSave } = scope;
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
