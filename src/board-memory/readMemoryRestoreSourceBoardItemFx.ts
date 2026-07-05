import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";

export const readMemoryRestoreSourceBoardItemFx = Effect.fn("readMemoryRestoreSourceBoardItemFx")(
	function* ({
		memoryItem,
		scope,
		usedItemInstanceIds,
	}: {
		memoryItem: BoardMemoryLayoutItem;
		scope: BoardMemoryActivationScope;
		usedItemInstanceIds: ReadonlySet<string>;
	}) {
		const { config, nextSave } = scope;
		if (
			isItemStorageAllowed({
				config,
				itemId: memoryItem.itemId,
				location: "inventory",
			})
		) {
			return undefined;
		}

		if (memoryItem.itemInstanceId) {
			const exactItem = nextSave.board.items[memoryItem.itemInstanceId];
			if (exactItem?.itemId === memoryItem.itemId) return exactItem;
		}

		const candidates = Object.values(nextSave.board.items).filter(
			(item) => item.itemId === memoryItem.itemId && !usedItemInstanceIds.has(item.id),
		);

		return (
			candidates.find((item) => item.x === memoryItem.x && item.y === memoryItem.y) ??
			candidates[0]
		);
	},
);
