import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionBoardMemoryActivateSchema } from "~/action/GameActionBoardMemoryActivateSchema";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemCount } from "~/board/readBoardItemCount";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { removeBoardMemoryLayoutFromSaveFx } from "~/board-memory/removeBoardMemoryLayoutFromSaveFx";
import { writeBoardMemoryLayoutToSaveFx } from "~/board-memory/writeBoardMemoryLayoutToSaveFx";
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
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { placeBoardItemInInventoryFx } from "~/placement/placeBoardItemInInventoryFx";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";
import { consumeInventorySlotQuantityFx } from "~/inventory/consumeInventorySlotQuantityFx";
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
	consumedEvent: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
	createdAtMs?: number;
	itemInstanceId?: string;
};

type BoardMemoryActivationScope = applyBoardMemoryActivateFx.Props & {
	events: GameEvent[];
	nextSave: GameSave;
};

const readSortedBoardItems = ({ save }: { save: GameSave }) =>
	Object.values(save.board.items).sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);

const readBoardMemorySnapshotItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.readBoardMemorySnapshotItemFx",
)(function* ({ item, scope }: { item: GameSaveBoardItem; scope: BoardMemoryActivationScope }) {
	const { config, nextSave } = scope;
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
	function* ({ scope }: { scope: BoardMemoryActivationScope }) {
		const { nextSave } = scope;
		const items: BoardMemoryLayoutItem[] = [];
		for (const item of readSortedBoardItems({
			save: nextSave,
		})) {
			items.push(
				yield* readBoardMemorySnapshotItemFx({
					item,
					scope,
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
});

const storeBoardItemInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.storeBoardItemInInventoryFx",
)(function* ({ item, scope }: { item: GameSaveBoardItem; scope: BoardMemoryActivationScope }) {
	const { config, events, nextSave } = scope;
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

	return yield* placeBoardItemInInventoryFx({
		config,
		events,
		item,
		mode:
			stateStatus.preservable || item.itemId === boardMemoryItemId
				? "preserve-instance"
				: "stack-copy",
		reason: "memory-store",
		save: nextSave,
	}).pipe(Effect.catchTag("GamePlacementFailed", () => Effect.succeed(false)));
});

const storeCurrentBoardItemsInInventoryFx = Effect.fn(
	"applyBoardMemoryActivateFx.storeCurrentBoardItemsInInventoryFx",
)(function* ({ scope }: { scope: BoardMemoryActivationScope }) {
	const { nextSave } = scope;
	for (const item of readSortedBoardItems({
		save: nextSave,
	})) {
		yield* storeBoardItemInInventoryFx({
			item,
			scope,
		});
	}
});

const restoreBoardOnlyLayoutItemsFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreBoardOnlyLayoutItemsFx",
)(function* ({
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
		const source = yield* readMemoryRestoreSourceBoardItemFx({
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
	"applyBoardMemoryActivateFx.consumePreferredInventoryInstanceForMemoryRestoreFx",
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
	"applyBoardMemoryActivateFx.consumeInventoryStackForMemoryRestoreFx",
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

const consumeInventoryItemForMemoryRestoreFx = Effect.fn(
	"applyBoardMemoryActivateFx.consumeInventoryItemForMemoryRestoreFx",
)(function* ({
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
});

const canRestoreInventoryBackedLayoutItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.canRestoreInventoryBackedLayoutItemFx",
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

const restoreInventoryBackedLayoutItemFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreInventoryBackedLayoutItemFx",
)(function* ({
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
	)
		return false;

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
});

const restoreInventoryBackedLayoutItemsFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreInventoryBackedLayoutItemsFx",
)(function* ({
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
});

const readBoardMemoryEngineResultFx = Effect.fn(
	"applyBoardMemoryActivateFx.readBoardMemoryEngineResultFx",
)(function* ({ scope }: { scope: BoardMemoryActivationScope }) {
	const { config, events, nextSave, nowMs } = scope;
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
)(function* ({ boardItemId, scope }: { boardItemId: string; scope: BoardMemoryActivationScope }) {
	const { events, nextSave, nowMs } = scope;
	const items = yield* readBoardMemorySnapshotFx({
		scope,
	});
	yield* writeBoardMemoryLayoutToSaveFx({
		boardItemId,
		layout: {
			items,
			savedAtMs: nowMs,
		},
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;
	events.push({
		atMs: nowMs,
		boardItemId,
		itemCount: items.length,
		type: "board.memory.saved",
	});

	return yield* readBoardMemoryEngineResultFx({
		scope,
	});
});

const restoreSavedBoardMemoryLayoutFx = Effect.fn(
	"applyBoardMemoryActivateFx.restoreSavedBoardMemoryLayoutFx",
)(function* ({
	boardItemId,
	savedItems,
	scope,
}: {
	boardItemId: string;
	savedItems: readonly BoardMemoryLayoutItem[];
	scope: BoardMemoryActivationScope;
}) {
	const { events, nextSave, nowMs } = scope;
	yield* storeCurrentBoardItemsInInventoryFx({
		scope,
	});
	const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
		savedItems,
		scope,
	});
	const restoredCount = yield* restoreInventoryBackedLayoutItemsFx({
		restoredIndexes: boardOnlyRestoredIndexes,
		savedItems,
		scope,
	});

	yield* removeBoardMemoryLayoutFromSaveFx({
		boardItemId,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;
	events.push({
		atMs: nowMs,
		boardItemId,
		restoredCount,
		storedCount: savedItems.length,
		type: "board.memory.restored",
	});

	return yield* readBoardMemoryEngineResultFx({
		scope,
	});
});

const readBoardMemoryActorFx = Effect.fn("applyBoardMemoryActivateFx.readBoardMemoryActorFx")(
	function* ({ scope }: { scope: BoardMemoryActivationScope }) {
		const { action, nextSave } = scope;
		const memoryItem = nextSave.board.items[action.boardItemId];
		if (memoryItem?.itemId === boardMemoryItemId) return memoryItem;

		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board memory item does not exist."),
		);
	},
);

const applyBoardMemoryActivateProgramFx = Effect.fn(
	"applyBoardMemoryActivateFx.applyBoardMemoryActivateProgramFx",
)(function* ({ scope }: { scope: BoardMemoryActivationScope }) {
	const { action, nextSave } = scope;
	yield* readBoardMemoryActorFx({
		scope,
	});
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
					scope,
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
					scope,
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

	return yield* applyBoardMemoryActivateProgramFx({
		scope: {
			...props,
			events: [],
			nextSave,
		},
	});
});
