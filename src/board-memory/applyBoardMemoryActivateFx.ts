import { Effect } from "effect";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameActionBoardMemoryActivateSchema } from "~/action/GameActionBoardMemoryActivateSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type {
	GameSave,
	GameSaveBoardItem,
	GameSaveInventorySlot,
} from "~/engine/model/GameSaveSchema";

export namespace applyBoardMemoryActivateFx {
	export interface Props {
		action: GameActionBoardMemoryActivateSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const readBoardMemorySnapshot = ({ config, save }: { config: GameConfig; save: GameSave }) =>
	Object.values(save.board.items)
		.sort(
			(left, right) =>
				left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
		)
		.map((item) => {
			const stateStatus = readBoardItemRuntimeStateStatus({
				itemInstanceId: item.id,
				save,
			});

			const inventoryStorageAllowed = isItemStorageAllowed({
				config,
				itemId: item.itemId,
				location: "inventory",
			});

			return {
				...(item.itemId === boardMemoryItemId ||
				stateStatus.preservable ||
				!inventoryStorageAllowed
					? {
							itemInstanceId: item.id,
						}
					: {}),
				itemId: item.itemId,
				x: item.x,
				y: item.y,
			};
		});

const readBoardItemCount = ({ itemId, save }: { itemId: string; save: GameSave }) =>
	Object.values(save.board.items).filter((item) => item.itemId === itemId).length;

const consumeInventoryItemFx = Effect.fn("applyBoardMemoryActivateFx.consumeInventoryItemFx")(
	function* ({
		itemId,
		preferredItemInstanceId,
		slots,
	}: {
		itemId: string;
		preferredItemInstanceId?: string;
		slots: GameSaveInventorySlot[];
	}) {
		const instanceSlotIndex = slots.findIndex(
			(slot) =>
				isGameSaveInventoryInstance(slot) &&
				slot.itemId === itemId &&
				(!preferredItemInstanceId || slot.id === preferredItemInstanceId),
		);
		if (instanceSlotIndex >= 0) {
			const slot = slots[instanceSlotIndex];
			if (!isGameSaveInventoryInstance(slot)) return undefined;
			slots[instanceSlotIndex] = null;
			return {
				createdAtMs: slot.createdAtMs,
				itemInstanceId: slot.id,
				nextQuantity: 0,
				previousQuantity: 1,
				quantity: 1,
				slotIndex: instanceSlotIndex,
			};
		}

		if (preferredItemInstanceId) return undefined;

		const stackSlotIndex = slots.findIndex(
			(slot) => isGameSaveInventoryStack(slot) && slot.itemId === itemId && slot.quantity > 0,
		);
		if (stackSlotIndex < 0) return undefined;

		const slot = slots[stackSlotIndex];
		if (!isGameSaveInventoryStack(slot)) return undefined;
		const previousQuantity = slot.quantity;
		const nextQuantity = previousQuantity - 1;
		if (nextQuantity > 0) {
			slot.quantity = nextQuantity;
		} else {
			slots[stackSlotIndex] = null;
		}
		return {
			createdAtMs: slot.createdAtMs,
			nextQuantity,
			previousQuantity,
			quantity: 1,
			slotIndex: stackSlotIndex,
		};
	},
);

const placeBoardItemInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeBoardItemInInventoryFx",
)(function* ({
	config,
	events,
	item,
	save,
}: {
	config: GameConfig;
	events: GameEvent[];
	item: GameSaveBoardItem;
	save: GameSave;
}) {
	const itemDefinition = config.items[item.itemId];
	if (!itemDefinition) return false;
	if (
		!isItemStorageAllowed({
			config,
			itemId: item.itemId,
			location: "inventory",
		})
	)
		return false;

	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: item.id,
		save,
	});
	if (stateStatus.busy) return false;

	events.push({
		from: {
			kind: "board",
			itemInstanceId: item.id,
		},
		itemId: item.itemId,
		reason: "memory-store",
		type: "item.consumed",
	});

	if (stateStatus.preservable || item.itemId === boardMemoryItemId) {
		const slotIndex = save.inventory.slots.findIndex((slot) => !slot);
		if (slotIndex < 0) {
			events.pop();
			return false;
		}

		save.inventory.slots[slotIndex] = {
			...(item.createdAtMs !== undefined
				? {
						createdAtMs: item.createdAtMs,
					}
				: {}),
			id: item.id,
			itemId: item.itemId,
			kind: "instance",
		};
		delete save.board.items[item.id];
		events.push({
			itemId: item.itemId,
			originItemInstanceId: item.id,
			reason: "memory-store",
			to: {
				kind: "inventory",
				nextQuantity: 1,
				previousQuantity: 0,
				quantity: 1,
				slotIndex,
			},
			type: "item.created",
		});
		return true;
	}

	for (const [slotIndex, slot] of save.inventory.slots.entries()) {
		if (!isGameSaveInventoryStack(slot) || slot.itemId !== item.itemId) continue;
		if (slot.quantity >= itemDefinition.maxStackSize) continue;

		const previousQuantity = slot.quantity;
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: item.id,
			save,
		});
		slot.quantity += 1;
		delete save.board.items[item.id];
		events.push({
			itemId: item.itemId,
			originItemInstanceId: item.id,
			reason: "memory-store",
			to: {
				kind: "inventory",
				nextQuantity: slot.quantity,
				previousQuantity,
				quantity: 1,
				slotIndex,
			},
			type: "item.created",
		});
		return true;
	}

	const emptySlotIndex = save.inventory.slots.findIndex((slot) => !slot);
	if (emptySlotIndex < 0) {
		events.pop();
		return false;
	}

	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: item.id,
		save,
	});
	save.inventory.slots[emptySlotIndex] = {
		...(item.createdAtMs !== undefined
			? {
					createdAtMs: item.createdAtMs,
				}
			: {}),
		itemId: item.itemId,
		quantity: 1,
	};
	delete save.board.items[item.id];
	events.push({
		itemId: item.itemId,
		originItemInstanceId: item.id,
		reason: "memory-store",
		to: {
			kind: "inventory",
			nextQuantity: 1,
			previousQuantity: 0,
			quantity: 1,
			slotIndex: emptySlotIndex,
		},
		type: "item.created",
	});
	return true;
});

const cellIsOccupied = ({ save, x, y }: { save: GameSave; x: number; y: number }) =>
	Object.values(save.board.items).some((item) => item.x === x && item.y === y);

const readBoardOnlyRestoreSource = ({
	config,
	memoryItem,
	save,
	usedItemInstanceIds,
}: {
	config: GameConfig;
	memoryItem: {
		itemId: string;
		itemInstanceId?: string;
		x: number;
		y: number;
	};
	save: GameSave;
	usedItemInstanceIds: ReadonlySet<string>;
}): GameSaveBoardItem | undefined => {
	if (
		isItemStorageAllowed({
			config,
			itemId: memoryItem.itemId,
			location: "inventory",
		})
	)
		return undefined;

	if (memoryItem.itemInstanceId) {
		const exactItem = save.board.items[memoryItem.itemInstanceId];
		if (exactItem?.itemId === memoryItem.itemId) return exactItem;
	}

	const candidates = Object.values(save.board.items).filter(
		(item) => item.itemId === memoryItem.itemId && !usedItemInstanceIds.has(item.id),
	);

	return (
		candidates.find((item) => item.x === memoryItem.x && item.y === memoryItem.y) ??
		candidates[0]
	);
};

const restoreBoardOnlyLayoutItemsFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreBoardOnlyLayoutItemsFx",
)(function* ({
	config,
	events,
	savedItems,
	save,
}: {
	config: GameConfig;
	events: GameEvent[];
	savedItems: readonly {
		itemId: string;
		itemInstanceId?: string;
		x: number;
		y: number;
	}[];
	save: GameSave;
}) {
	const restoredIndexes = new Set<number>();
	const usedItemInstanceIds = new Set<string>();

	for (const [index, memoryItem] of savedItems.entries()) {
		const source = readBoardOnlyRestoreSource({
			config,
			memoryItem,
			save,
			usedItemInstanceIds,
		});
		if (!source) continue;
		if (source.x === memoryItem.x && source.y === memoryItem.y) {
			restoredIndexes.add(index);
			usedItemInstanceIds.add(source.id);
			continue;
		}

		events.push({
			from: {
				kind: "board",
				itemInstanceId: source.id,
			},
			itemId: source.itemId,
			reason: "memory-store",
			type: "item.consumed",
		});
		source.x = memoryItem.x;
		source.y = memoryItem.y;
		events.push({
			itemId: source.itemId,
			originItemInstanceId: source.id,
			reason: "memory-restore",
			to: {
				kind: "board",
				itemInstanceId: source.id,
				x: memoryItem.x,
				y: memoryItem.y,
			},
			type: "item.created",
		});
		restoredIndexes.add(index);
		usedItemInstanceIds.add(source.id);
	}

	return restoredIndexes;
});

export const applyBoardMemoryActivateFx = Effect.fn("applyBoardMemoryActivateFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: applyBoardMemoryActivateFx.Props) {
	const memoryItem = save.board.items[action.boardItemId];
	if (!memoryItem || memoryItem.itemId !== boardMemoryItemId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board memory item does not exist."),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const savedLayout = nextSave.boardMemoryLayouts[action.boardItemId];

	if (!savedLayout) {
		const items = readBoardMemorySnapshot({
			config,
			save: nextSave,
		});
		nextSave.boardMemoryLayouts[action.boardItemId] = {
			items,
			savedAtMs: nowMs,
		};
		nextSave.updatedAtMs = nowMs;
		events.push({
			atMs: nowMs,
			boardItemId: action.boardItemId,
			itemCount: items.length,
			type: "board.memory.saved",
		});

		return {
			events,
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				config,
				nowMs,
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	}

	for (const item of Object.values(nextSave.board.items).sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	)) {
		yield* placeBoardItemInInventoryFx({
			config,
			events,
			item,
			save: nextSave,
		});
	}

	const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
		config,
		events,
		savedItems: savedLayout.items,
		save: nextSave,
	});

	let restoredCount = boardOnlyRestoredIndexes.size;
	for (const [memoryItemIndex, memoryItem] of savedLayout.items.entries()) {
		if (boardOnlyRestoredIndexes.has(memoryItemIndex)) continue;
		if (
			cellIsOccupied({
				save: nextSave,
				x: memoryItem.x,
				y: memoryItem.y,
			})
		)
			continue;
		const definition = config.items[memoryItem.itemId];
		if (!definition) continue;
		if (
			!isItemStorageAllowed({
				config,
				itemId: memoryItem.itemId,
				location: "board",
			})
		)
			continue;
		const maxCount = definition.maxCount;
		if (
			maxCount !== undefined &&
			readBoardItemCount({
				itemId: memoryItem.itemId,
				save: nextSave,
			}) >= maxCount
		) {
			continue;
		}

		const consumed = yield* consumeInventoryItemFx({
			itemId: memoryItem.itemId,
			preferredItemInstanceId: memoryItem.itemInstanceId,
			slots: nextSave.inventory.slots,
		});
		if (!consumed) continue;

		const itemInstanceId = consumed.itemInstanceId ?? (yield* createGameItemInstanceIdFx());
		events.push({
			from: {
				kind: "inventory",
				nextQuantity: consumed.nextQuantity,
				previousQuantity: consumed.previousQuantity,
				quantity: consumed.quantity,
				slotIndex: consumed.slotIndex,
			},
			itemId: memoryItem.itemId,
			reason: "memory-restore",
			type: "item.consumed",
		});
		nextSave.board.items[itemInstanceId] = {
			...(consumed.createdAtMs !== undefined
				? {
						createdAtMs: consumed.createdAtMs,
					}
				: {}),
			id: itemInstanceId,
			itemId: memoryItem.itemId,
			x: memoryItem.x,
			y: memoryItem.y,
		};
		events.push({
			itemId: memoryItem.itemId,
			originItemInstanceId: action.boardItemId,
			reason: "memory-restore",
			to: {
				kind: "board",
				itemInstanceId,
				x: memoryItem.x,
				y: memoryItem.y,
			},
			type: "item.created",
		});
		restoredCount += 1;
	}

	delete nextSave.boardMemoryLayouts[action.boardItemId];

	nextSave.updatedAtMs = nowMs;
	events.push({
		atMs: nowMs,
		boardItemId: action.boardItemId,
		restoredCount,
		storedCount: savedLayout.items.length,
		type: "board.memory.restored",
	});

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
