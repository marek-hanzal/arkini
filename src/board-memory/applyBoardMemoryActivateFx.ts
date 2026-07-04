import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionBoardMemoryActivateSchema } from "~/action/GameActionBoardMemoryActivateSchema";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
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
import { createInventoryItemConsumedEventFx } from "~/inventory/createInventoryItemConsumedEventFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";
import { pushInventoryItemCreatedEventFx } from "~/placement/pushInventoryItemCreatedEventFx";
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
	events.push(
		yield* createBoardItemConsumedEventFx({
			itemId: item.itemId,
			itemInstanceId: item.id,
			reason: "memory-store",
		}),
	);
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
	yield* pushInventoryItemCreatedEventFx({
		events,
		itemId: item.itemId,
		nextQuantity,
		originItemInstanceId: item.id,
		previousQuantity,
		quantity: 1,
		reason: "memory-store",
		slotIndex,
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

const placeStackableBoardItemInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.placeStackableBoardItemInInventoryFx",
)(function* ({ item }: { item: GameSaveBoardItem }) {
	const { config, events, nextSave } = yield* BoardMemoryActivationScopeFx;
	const itemDefinition = config.items[item.itemId];
	if (!itemDefinition) return false;

	const placementEvents: GameEvent[] = [];
	const placed = yield* placeGameSaveInventoryRemainderFx({
		createdAtMs: item.createdAtMs,
		events: placementEvents,
		item: {
			itemId: item.itemId,
			originItemInstanceId: item.id,
			quantity: 1,
			reason: "memory-store",
		},
		maxStackSize: itemDefinition.maxStackSize,
		remainingQuantity: 1,
		slots: nextSave.inventory.slots,
	});
	if (!placed) return false;

	yield* appendMemoryStoreBoardConsumedEventFx({
		item,
	});
	events.push(...placementEvents);
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: item.id,
		save: nextSave,
	});
	delete nextSave.board.items[item.id];
	return true;
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
	events.push(
		yield* createInventoryItemConsumedEventFx({
			itemId,
			nextQuantity: consumed.nextQuantity,
			previousQuantity: consumed.previousQuantity,
			quantity: consumed.quantity,
			reason: "memory-restore",
			slotIndex: consumed.slotIndex,
		}),
	);
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
	const { action, events } = yield* BoardMemoryActivationScopeFx;
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
