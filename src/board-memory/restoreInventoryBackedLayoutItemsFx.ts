import { Effect } from "effect";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import { canRestoreInventoryBackedLayoutItemFx } from "~/board-memory/canRestoreInventoryBackedLayoutItemFx";
import { consumeInventoryItemForMemoryRestoreFx } from "~/board-memory/consumeInventoryItemForMemoryRestoreFx";
import { readBoardMemoryLayoutItemQuantity } from "~/board-memory/readBoardMemoryLayoutItemQuantity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

const restoreInventoryBackedLayoutItemFx = Effect.fn("restoreInventoryBackedLayoutItemFx")(
	function* ({
		boardMemoryItemInstanceId,
		config,
		events,
		memoryItem,
		nextSave,
	}: {
		boardMemoryItemInstanceId: string;
		config: GameConfig;
		events: GameEvent[];
		memoryItem: BoardMemoryLayoutItem;
		nextSave: GameSave;
	}) {
		if (
			!(yield* canRestoreInventoryBackedLayoutItemFx({
				config,
				memoryItem,
				nextSave,
			}))
		) {
			return false;
		}

		const consumed = yield* consumeInventoryItemForMemoryRestoreFx({
			memoryItem,
			nextSave,
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
			originItemInstanceId: boardMemoryItemInstanceId,
			reason: "memory-restore",
			save: nextSave,
		});
		return true;
	},
);

export const restoreInventoryBackedLayoutItemsFx = Effect.fn("restoreInventoryBackedLayoutItemsFx")(
	function* ({
		boardMemoryItemInstanceId,
		config,
		events,
		nextSave,
		restoredIndexes,
		savedItems,
	}: {
		boardMemoryItemInstanceId: string;
		config: GameConfig;
		events: GameEvent[];
		nextSave: GameSave;
		restoredIndexes: Set<number>;
		savedItems: readonly BoardMemoryLayoutItem[];
	}) {
		let restoredCount = restoredIndexes.size;
		for (const [memoryItemIndex, memoryItem] of savedItems.entries()) {
			if (restoredIndexes.has(memoryItemIndex)) continue;
			if (
				yield* restoreInventoryBackedLayoutItemFx({
					boardMemoryItemInstanceId,
					config,
					events,
					memoryItem,
					nextSave,
				})
			) {
				restoredCount += 1;
			}
		}
		return restoredCount;
	},
);
