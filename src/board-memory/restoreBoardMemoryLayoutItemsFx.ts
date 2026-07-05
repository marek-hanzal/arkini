import { Effect } from "effect";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemCount } from "~/board/readBoardItemCount";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { consumeInventorySlotQuantityFx } from "~/inventory/consumeInventorySlotQuantityFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

type InventoryConsumedForMemoryRestore = {
	consumedEvent: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
	createdAtMs?: number;
	itemInstanceId?: string;
};

const readMemoryRestoreSourceBoardItemFx = Effect.fn("readMemoryRestoreSourceBoardItemFx")(
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

const restoreBoardOnlyLayoutItemsFx = Effect.fn("restoreBoardOnlyLayoutItemsFx")(function* ({
	savedItems,
	scope,
}: {
	savedItems: readonly BoardMemoryLayoutItem[];
	scope: BoardMemoryActivationScope;
}) {
	const { events } = scope;
	const restoredIndexes = new Set<number>();
	const usedItemInstanceIds = new Set<string>();

	for (const [index, memoryItem] of savedItems.entries()) {
		const source: GameSaveBoardItem | undefined = yield* readMemoryRestoreSourceBoardItemFx({
			memoryItem,
			scope,
			usedItemInstanceIds,
		});
		if (!source) continue;
		if (source.x !== memoryItem.x || source.y !== memoryItem.y) {
			events.push(
				yield* createBoardItemConsumedEventFx({
					itemId: source.itemId,
					itemInstanceId: source.id,
					reason: "memory-store",
				}),
			);
			source.x = memoryItem.x;
			source.y = memoryItem.y;
			yield* pushBoardItemCreatedEventFx({
				cell: {
					x: memoryItem.x,
					y: memoryItem.y,
				},
				events,
				itemId: source.itemId,
				itemInstanceId: source.id,
				originItemInstanceId: source.id,
				reason: "memory-restore",
			});
		}

		restoredIndexes.add(index);
		usedItemInstanceIds.add(source.id);
	}

	return restoredIndexes;
});

const consumePreferredInventoryInstanceForMemoryRestoreFx = Effect.fn(
	"consumePreferredInventoryInstanceForMemoryRestoreFx",
)(function* ({
	itemId,
	preferredItemInstanceId,
	scope,
}: {
	itemId: string;
	preferredItemInstanceId?: string;
	scope: BoardMemoryActivationScope;
}) {
	if (!preferredItemInstanceId) return undefined;
	const { nextSave } = scope;
	const slotIndex = nextSave.inventory.slots.findIndex(
		(slot) =>
			isGameSaveInventoryInstance(slot) &&
			slot.itemId === itemId &&
			slot.id === preferredItemInstanceId,
	);
	if (slotIndex < 0) return undefined;

	const consumed = yield* consumeInventorySlotQuantityFx({
		nextSave,
		quantity: 1,
		reason: "memory-restore",
		runtimeState: "preserve-instance",
		slotIndex,
	});
	if (!isGameSaveInventoryInstance(consumed.slot)) return undefined;

	return {
		consumedEvent: consumed.consumedEvent,
		createdAtMs: consumed.slot.createdAtMs,
		itemInstanceId: consumed.slot.id,
	} satisfies InventoryConsumedForMemoryRestore;
});

const consumeInventoryStackForMemoryRestoreFx = Effect.fn(
	"consumeInventoryStackForMemoryRestoreFx",
)(function* ({ itemId, scope }: { itemId: string; scope: BoardMemoryActivationScope }) {
	const { nextSave } = scope;
	const slotIndex = nextSave.inventory.slots.findIndex(
		(slot) => isGameSaveInventoryStack(slot) && slot.itemId === itemId && slot.quantity > 0,
	);
	if (slotIndex < 0) return undefined;

	const consumed = yield* consumeInventorySlotQuantityFx({
		nextSave,
		quantity: 1,
		reason: "memory-restore",
		runtimeState: "remove-instance",
		slotIndex,
	});

	return {
		consumedEvent: consumed.consumedEvent,
		createdAtMs: consumed.slot.createdAtMs,
		itemInstanceId: undefined,
	} satisfies InventoryConsumedForMemoryRestore;
});

const consumeInventoryItemForMemoryRestoreFx = Effect.fn("consumeInventoryItemForMemoryRestoreFx")(
	function* ({
		memoryItem,
		scope,
	}: {
		memoryItem: BoardMemoryLayoutItem;
		scope: BoardMemoryActivationScope;
	}) {
		return (
			(yield* consumePreferredInventoryInstanceForMemoryRestoreFx({
				itemId: memoryItem.itemId,
				preferredItemInstanceId: memoryItem.itemInstanceId,
				scope,
			})) ??
			(memoryItem.itemInstanceId
				? undefined
				: yield* consumeInventoryStackForMemoryRestoreFx({
						itemId: memoryItem.itemId,
						scope,
					}))
		);
	},
);

const canRestoreInventoryBackedLayoutItemFx = Effect.fn("canRestoreInventoryBackedLayoutItemFx")(
	function* ({
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
	},
);

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
		events.push(consumed.consumedEvent);
		yield* placeBoardItemInstanceFx({
			cell: {
				x: memoryItem.x,
				y: memoryItem.y,
			},
			createdAtMs: consumed.createdAtMs,
			events,
			itemId: memoryItem.itemId,
			itemInstanceId,
			originItemInstanceId: action.boardItemId,
			reason: "memory-restore",
			save: nextSave,
		});
		return true;
	},
);

const restoreInventoryBackedLayoutItemsFx = Effect.fn("restoreInventoryBackedLayoutItemsFx")(
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

export const restoreBoardMemoryLayoutItemsFx = Effect.fn("restoreBoardMemoryLayoutItemsFx")(
	function* ({
		savedItems,
		scope,
	}: {
		savedItems: readonly BoardMemoryLayoutItem[];
		scope: BoardMemoryActivationScope;
	}) {
		const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
			savedItems,
			scope,
		});
		return yield* restoreInventoryBackedLayoutItemsFx({
			restoredIndexes: boardOnlyRestoredIndexes,
			savedItems,
			scope,
		});
	},
);
