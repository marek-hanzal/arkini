import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionBoardMemoryActivateSchema } from "~/action/GameActionBoardMemoryActivateSchema";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemCount } from "~/board/readBoardItemCount";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

export namespace applyBoardMemoryActivateFx {
	export interface Props {
		action: GameActionBoardMemoryActivateSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

type BoardMemoryLayoutItem = {
	itemId: string;
	itemInstanceId?: string;
	x: number;
	y: number;
};

type InventoryConsumedForMemoryRestore = {
	createdAtMs?: number;
	itemInstanceId?: string;
	nextQuantity: number;
	previousQuantity: number;
	quantity: number;
	slotIndex: number;
};

type BoardMemoryActivationScope = applyBoardMemoryActivateFx.Props & {
	events: GameEvent[];
	nextSave: GameSave;
};

class BoardMemoryActivationScopeFx extends Context.Tag("BoardMemoryActivationScopeFx")<
	BoardMemoryActivationScopeFx,
	BoardMemoryActivationScope
>() {
	//
}

const readSortedBoardItems = ({ save }: { save: GameSave }) =>
	Object.values(save.board.items).sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);

const readBoardMemorySnapshotItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.readBoardMemorySnapshotItemFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { config, nextSave } = yield* BoardMemoryActivationScopeFx;
	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: item.id,
		save: nextSave,
	});
	const inventoryStorageAllowed = isItemStorageAllowed({
		config,
		itemId: item.itemId,
		location: "inventory",
	});

	return {
		...(item.itemId === boardMemoryItemId || stateStatus.preservable || !inventoryStorageAllowed
			? {
					itemInstanceId: item.id,
				}
			: {}),
		itemId: item.itemId,
		x: item.x,
		y: item.y,
	} satisfies BoardMemoryLayoutItem;
});

const readBoardMemorySnapshotFx = Effect.fn("applyBoardMemoryActivateFx.readBoardMemorySnapshotFx")(
	function* () {
		const { nextSave } = yield* BoardMemoryActivationScopeFx;
		const items: BoardMemoryLayoutItem[] = [];
		for (const item of readSortedBoardItems({
			save: nextSave,
		})) {
			items.push(
				yield* readBoardMemorySnapshotItemFx({
					item,
				}),
			);
		}
		return items;
	},
);

const readMemoryRestoreSourceBoardItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.readMemoryRestoreSourceBoardItemFx",
)(function* ({
	memoryItem,
	usedItemInstanceIds,
}: {
	memoryItem: BoardMemoryLayoutItem;
	usedItemInstanceIds: ReadonlySet<string>;
}) {
	const { config, nextSave } = yield* BoardMemoryActivationScopeFx;
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
});

const appendMemoryStoreBoardConsumedEventFx = Effect.fn(
	"applyBoardMemoryActivateFx.appendMemoryStoreBoardConsumedEventFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { events } = yield* BoardMemoryActivationScopeFx;
	events.push({
		from: {
			kind: "board",
			itemInstanceId: item.id,
		},
		itemId: item.itemId,
		reason: "memory-store",
		type: "item.consumed",
	});
});

const appendMemoryStoreInventoryCreatedEventFx = Effect.fn(
	"applyBoardMemoryActivateFx.appendMemoryStoreInventoryCreatedEventFx",
)(function* ({
	item,
	nextQuantity,
	previousQuantity,
	slotIndex,
}: {
	item: GameSaveBoardItem;
	nextQuantity: number;
	previousQuantity: number;
	slotIndex: number;
}) {
	const { events } = yield* BoardMemoryActivationScopeFx;
	events.push({
		itemId: item.itemId,
		originItemInstanceId: item.id,
		reason: "memory-store",
		to: {
			kind: "inventory",
			nextQuantity,
			previousQuantity,
			quantity: 1,
			slotIndex,
		},
		type: "item.created",
	});
});

const placeRuntimeStatePreservingBoardItemInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeRuntimeStatePreservingBoardItemInInventoryFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { nextSave } = yield* BoardMemoryActivationScopeFx;
	const slotIndex = nextSave.inventory.slots.findIndex((slot) => !slot);
	if (slotIndex < 0) return false;

	yield* appendMemoryStoreBoardConsumedEventFx({
		item,
	});
	nextSave.inventory.slots[slotIndex] = {
		...(item.createdAtMs !== undefined
			? {
					createdAtMs: item.createdAtMs,
				}
			: {}),
		id: item.id,
		itemId: item.itemId,
		kind: "instance",
	};
	delete nextSave.board.items[item.id];
	yield* appendMemoryStoreInventoryCreatedEventFx({
		item,
		nextQuantity: 1,
		previousQuantity: 0,
		slotIndex,
	});
	return true;
});

const placeStackableBoardItemIntoExistingInventoryStackFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeStackableBoardItemIntoExistingInventoryStackFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { config, nextSave } = yield* BoardMemoryActivationScopeFx;
	const itemDefinition = config.items[item.itemId];
	if (!itemDefinition) return false;

	for (const [slotIndex, slot] of nextSave.inventory.slots.entries()) {
		if (!isGameSaveInventoryStack(slot) || slot.itemId !== item.itemId) continue;
		if (slot.quantity >= itemDefinition.maxStackSize) continue;

		yield* appendMemoryStoreBoardConsumedEventFx({
			item,
		});
		const previousQuantity = slot.quantity;
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: item.id,
			save: nextSave,
		});
		slot.quantity += 1;
		delete nextSave.board.items[item.id];
		yield* appendMemoryStoreInventoryCreatedEventFx({
			item,
			nextQuantity: slot.quantity,
			previousQuantity,
			slotIndex,
		});
		return true;
	}

	return false;
});

const placeStackableBoardItemIntoEmptyInventorySlotFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeStackableBoardItemIntoEmptyInventorySlotFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { nextSave } = yield* BoardMemoryActivationScopeFx;
	const emptySlotIndex = nextSave.inventory.slots.findIndex((slot) => !slot);
	if (emptySlotIndex < 0) return false;

	yield* appendMemoryStoreBoardConsumedEventFx({
		item,
	});
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: item.id,
		save: nextSave,
	});
	nextSave.inventory.slots[emptySlotIndex] = {
		...(item.createdAtMs !== undefined
			? {
					createdAtMs: item.createdAtMs,
				}
			: {}),
		itemId: item.itemId,
		quantity: 1,
	};
	delete nextSave.board.items[item.id];
	yield* appendMemoryStoreInventoryCreatedEventFx({
		item,
		nextQuantity: 1,
		previousQuantity: 0,
		slotIndex: emptySlotIndex,
	});
	return true;
});

const placeStackableBoardItemInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeStackableBoardItemInInventoryFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	return (
		(yield* placeStackableBoardItemIntoExistingInventoryStackFx({
			item,
		})) ||
		(yield* placeStackableBoardItemIntoEmptyInventorySlotFx({
			item,
		}))
	);
});

const placeBoardItemInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeBoardItemInInventoryFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { config, nextSave } = yield* BoardMemoryActivationScopeFx;
	if (!config.items[item.itemId]) return false;
	if (
		!isItemStorageAllowed({
			config,
			itemId: item.itemId,
			location: "inventory",
		})
	) {
		return false;
	}

	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: item.id,
		save: nextSave,
	});
	if (stateStatus.busy) return false;

	return yield* match(stateStatus.preservable || item.itemId === boardMemoryItemId)
		.with(true, () =>
			placeRuntimeStatePreservingBoardItemInInventoryFx({
				item,
			}),
		)
		.with(false, () =>
			placeStackableBoardItemInInventoryFx({
				item,
			}),
		)
		.exhaustive();
});

const storeCurrentBoardItemsInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.storeCurrentBoardItemsInInventoryFx",
)(function* () {
	const { nextSave } = yield* BoardMemoryActivationScopeFx;
	for (const item of readSortedBoardItems({
		save: nextSave,
	})) {
		yield* placeBoardItemInInventoryFx({
			item,
		});
	}
});

const restoreBoardOnlyLayoutItemsFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreBoardOnlyLayoutItemsFx",
)(function* ({ savedItems }: { savedItems: readonly BoardMemoryLayoutItem[] }) {
	const { events } = yield* BoardMemoryActivationScopeFx;
	const restoredIndexes = new Set<number>();
	const usedItemInstanceIds = new Set<string>();

	for (const [index, memoryItem] of savedItems.entries()) {
		const source = yield* readMemoryRestoreSourceBoardItemFx({
			memoryItem,
			usedItemInstanceIds,
		});
		if (!source) continue;
		if (source.x !== memoryItem.x || source.y !== memoryItem.y) {
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
		}

		restoredIndexes.add(index);
		usedItemInstanceIds.add(source.id);
	}

	return restoredIndexes;
});

const consumePreferredInventoryInstanceForMemoryRestoreFx = Effect.fn(
	"applyBoardMemoryActivateFx.consumePreferredInventoryInstanceForMemoryRestoreFx",
)(function* ({
	itemId,
	preferredItemInstanceId,
}: {
	itemId: string;
	preferredItemInstanceId?: string;
}) {
	if (!preferredItemInstanceId) return undefined;
	const { nextSave } = yield* BoardMemoryActivationScopeFx;
	const instanceSlotIndex = nextSave.inventory.slots.findIndex(
		(slot) =>
			isGameSaveInventoryInstance(slot) &&
			slot.itemId === itemId &&
			slot.id === preferredItemInstanceId,
	);
	if (instanceSlotIndex < 0) return undefined;

	const slot = nextSave.inventory.slots[instanceSlotIndex];
	if (!isGameSaveInventoryInstance(slot)) return undefined;
	nextSave.inventory.slots[instanceSlotIndex] = null;
	const consumed: InventoryConsumedForMemoryRestore = {
		createdAtMs: slot.createdAtMs,
		itemInstanceId: slot.id,
		nextQuantity: 0,
		previousQuantity: 1,
		quantity: 1,
		slotIndex: instanceSlotIndex,
	};
	return consumed;
});

const consumeInventoryStackForMemoryRestoreFx = Effect.fn(
	"applyBoardMemoryActivateFx.consumeInventoryStackForMemoryRestoreFx",
)(function* ({ itemId }: { itemId: string }) {
	const { nextSave } = yield* BoardMemoryActivationScopeFx;
	const stackSlotIndex = nextSave.inventory.slots.findIndex(
		(slot) => isGameSaveInventoryStack(slot) && slot.itemId === itemId && slot.quantity > 0,
	);
	if (stackSlotIndex < 0) return undefined;

	const slot = nextSave.inventory.slots[stackSlotIndex];
	if (!isGameSaveInventoryStack(slot)) return undefined;
	const previousQuantity = slot.quantity;
	const nextQuantity = previousQuantity - 1;
	if (nextQuantity > 0) {
		slot.quantity = nextQuantity;
	} else {
		nextSave.inventory.slots[stackSlotIndex] = null;
	}
	const consumed: InventoryConsumedForMemoryRestore = {
		createdAtMs: slot.createdAtMs,
		nextQuantity,
		previousQuantity,
		quantity: 1,
		slotIndex: stackSlotIndex,
	};
	return consumed;
});

const consumeInventoryItemForMemoryRestoreFx = Effect.fn(
	"applyBoardMemoryActivateFx.consumeInventoryItemForMemoryRestoreFx",
)(function* ({ memoryItem }: { memoryItem: BoardMemoryLayoutItem }) {
	return (
		(yield* consumePreferredInventoryInstanceForMemoryRestoreFx({
			itemId: memoryItem.itemId,
			preferredItemInstanceId: memoryItem.itemInstanceId,
		})) ??
		(memoryItem.itemInstanceId
			? undefined
			: yield* consumeInventoryStackForMemoryRestoreFx({
					itemId: memoryItem.itemId,
				}))
	);
});

const canRestoreInventoryBackedLayoutItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.canRestoreInventoryBackedLayoutItemFx",
)(function* ({ memoryItem }: { memoryItem: BoardMemoryLayoutItem }) {
	const { config, nextSave } = yield* BoardMemoryActivationScopeFx;
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

const appendMemoryRestoreInventoryConsumedEventFx = Effect.fn(
	"applyBoardMemoryActivateFx.appendMemoryRestoreInventoryConsumedEventFx",
)(function* ({
	consumed,
	itemId,
}: {
	consumed: InventoryConsumedForMemoryRestore;
	itemId: string;
}) {
	const { events } = yield* BoardMemoryActivationScopeFx;
	events.push({
		from: {
			kind: "inventory",
			nextQuantity: consumed.nextQuantity,
			previousQuantity: consumed.previousQuantity,
			quantity: consumed.quantity,
			slotIndex: consumed.slotIndex,
		},
		itemId,
		reason: "memory-restore",
		type: "item.consumed",
	});
});

const appendMemoryRestoreBoardCreatedEventFx = Effect.fn(
	"applyBoardMemoryActivateFx.appendMemoryRestoreBoardCreatedEventFx",
)(function* ({
	itemInstanceId,
	memoryItem,
}: {
	itemInstanceId: string;
	memoryItem: BoardMemoryLayoutItem;
}) {
	const { action, events } = yield* BoardMemoryActivationScopeFx;
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
});

const restoreInventoryBackedLayoutItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreInventoryBackedLayoutItemFx",
)(function* ({ memoryItem }: { memoryItem: BoardMemoryLayoutItem }) {
	const { nextSave } = yield* BoardMemoryActivationScopeFx;
	if (
		!(yield* canRestoreInventoryBackedLayoutItemFx({
			memoryItem,
		}))
	)
		return false;

	const consumed = yield* consumeInventoryItemForMemoryRestoreFx({
		memoryItem,
	});
	if (!consumed) return false;

	const itemInstanceId = consumed.itemInstanceId ?? (yield* createGameItemInstanceIdFx());
	yield* appendMemoryRestoreInventoryConsumedEventFx({
		consumed,
		itemId: memoryItem.itemId,
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
	yield* appendMemoryRestoreBoardCreatedEventFx({
		itemInstanceId,
		memoryItem,
	});
	return true;
});

const restoreInventoryBackedLayoutItemsFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreInventoryBackedLayoutItemsFx",
)(function* ({
	restoredIndexes,
	savedItems,
}: {
	restoredIndexes: Set<number>;
	savedItems: readonly BoardMemoryLayoutItem[];
}) {
	let restoredCount = restoredIndexes.size;
	for (const [memoryItemIndex, memoryItem] of savedItems.entries()) {
		if (restoredIndexes.has(memoryItemIndex)) continue;
		if (
			yield* restoreInventoryBackedLayoutItemFx({
				memoryItem,
			})
		) {
			restoredCount += 1;
		}
	}
	return restoredCount;
});

const readBoardMemoryEngineResultFx = Effect.fn(
	"applyBoardMemoryActivateFx.readBoardMemoryEngineResultFx",
)(function* () {
	const { config, events, nextSave, nowMs } = yield* BoardMemoryActivationScopeFx;
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

const saveCurrentBoardMemoryLayoutFx = Effect.fn(
	"applyBoardMemoryActivateFx.saveCurrentBoardMemoryLayoutFx",
)(function* ({ boardItemId }: { boardItemId: string }) {
	const { events, nextSave, nowMs } = yield* BoardMemoryActivationScopeFx;
	const items = yield* readBoardMemorySnapshotFx();
	nextSave.boardMemoryLayouts[boardItemId] = {
		items,
		savedAtMs: nowMs,
	};
	nextSave.updatedAtMs = nowMs;
	events.push({
		atMs: nowMs,
		boardItemId,
		itemCount: items.length,
		type: "board.memory.saved",
	});

	return yield* readBoardMemoryEngineResultFx();
});

const restoreSavedBoardMemoryLayoutFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreSavedBoardMemoryLayoutFx",
)(function* ({
	boardItemId,
	savedItems,
}: {
	boardItemId: string;
	savedItems: readonly BoardMemoryLayoutItem[];
}) {
	const { events, nextSave, nowMs } = yield* BoardMemoryActivationScopeFx;
	yield* storeCurrentBoardItemsInInventoryFx();
	const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
		savedItems,
	});
	const restoredCount = yield* restoreInventoryBackedLayoutItemsFx({
		restoredIndexes: boardOnlyRestoredIndexes,
		savedItems,
	});

	delete nextSave.boardMemoryLayouts[boardItemId];
	nextSave.updatedAtMs = nowMs;
	events.push({
		atMs: nowMs,
		boardItemId,
		restoredCount,
		storedCount: savedItems.length,
		type: "board.memory.restored",
	});

	return yield* readBoardMemoryEngineResultFx();
});

const readBoardMemoryActorFx = Effect.fn("applyBoardMemoryActivateFx.readBoardMemoryActorFx")(
	function* () {
		const { action, nextSave } = yield* BoardMemoryActivationScopeFx;
		const memoryItem = nextSave.board.items[action.boardItemId];
		if (memoryItem?.itemId === boardMemoryItemId) return memoryItem;

		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board memory item does not exist."),
		);
	},
);

const applyBoardMemoryActivateProgramFx = Effect.fn(
	"applyBoardMemoryActivateFx.applyBoardMemoryActivateProgramFx",
)(function* () {
	const { action, nextSave } = yield* BoardMemoryActivationScopeFx;
	yield* readBoardMemoryActorFx();
	const savedLayout = nextSave.boardMemoryLayouts[action.boardItemId];
	const activationRoute = savedLayout
		? ({
				kind: "restore",
				savedItems: savedLayout.items,
			} as const)
		: ({
				kind: "save",
			} as const);

	return yield* match(activationRoute)
		.with(
			{
				kind: "save",
			},
			() =>
				saveCurrentBoardMemoryLayoutFx({
					boardItemId: action.boardItemId,
				}),
		)
		.with(
			{
				kind: "restore",
			},
			({ savedItems }) =>
				restoreSavedBoardMemoryLayoutFx({
					boardItemId: action.boardItemId,
					savedItems,
				}),
		)
		.exhaustive();
});

export const applyBoardMemoryActivateFx = Effect.fn("applyBoardMemoryActivateFx")(function* (
	props: applyBoardMemoryActivateFx.Props,
) {
	const nextSave = yield* cloneGameSaveFx({
		save: props.save,
	});

	return yield* Effect.provideService(
		applyBoardMemoryActivateProgramFx(),
		BoardMemoryActivationScopeFx,
		{
			...props,
			events: [],
			nextSave,
		},
	);
});
