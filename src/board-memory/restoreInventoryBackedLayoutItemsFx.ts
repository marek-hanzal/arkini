import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { canRestoreInventoryBackedLayoutItemFx } from "~/board-memory/canRestoreInventoryBackedLayoutItemFx";
import { consumeInventoryItemForMemoryRestoreFx } from "~/board-memory/consumeInventoryItemForMemoryRestoreFx";
import { readBoardMemoryLayoutItemQuantity } from "~/board-memory/readBoardMemoryLayoutItemQuantity";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

const restoreInventoryBackedLayoutItemFx = Effect.fn("restoreInventoryBackedLayoutItemFx")(
	function* ({
		memoryItem,
		scope,
	}: {
		memoryItem: BoardMemoryLayoutItem;
		scope: BoardMemoryActivationScope;
	}) {
		const { action, events, nextSave } = scope;
		if (
			!(yield* canRestoreInventoryBackedLayoutItemFx({
				memoryItem,
				scope,
			}))
		) {
			return false;
		}

		const consumed = yield* consumeInventoryItemForMemoryRestoreFx({
			memoryItem,
			scope,
		});
		if (!consumed) return false;

		const itemInstanceId = consumed.itemInstanceId ?? (yield* createGameItemInstanceIdFx());
		events.push(...consumed.consumedEvents);
		yield* placeBoardItemInstanceFx({
			cell: {
				x: memoryItem.x,
				y: memoryItem.y,
			},
			createdAtMs: consumed.createdAtMs,
			events,
			itemId: memoryItem.itemId,
			itemInstanceId,
			quantity: readBoardMemoryLayoutItemQuantity(memoryItem),
			originItemInstanceId: action.boardItemId,
			reason: "memory-restore",
			save: nextSave,
		});
		return true;
	},
);

export const restoreInventoryBackedLayoutItemsFx = Effect.fn("restoreInventoryBackedLayoutItemsFx")(
	function* ({
		restoredIndexes,
		savedItems,
		scope,
	}: {
		restoredIndexes: Set<number>;
		savedItems: readonly BoardMemoryLayoutItem[];
		scope: BoardMemoryActivationScope;
	}) {
		let restoredCount = restoredIndexes.size;
		for (const [memoryItemIndex, memoryItem] of savedItems.entries()) {
			if (restoredIndexes.has(memoryItemIndex)) continue;
			if (
				yield* restoreInventoryBackedLayoutItemFx({
					memoryItem,
					scope,
				})
			) {
				restoredCount += 1;
			}
		}
		return restoredCount;
	},
);
