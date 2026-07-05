import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import type { InventoryConsumedForMemoryRestore } from "~/board-memory/BoardMemoryRestoreTypes";
import { consumeInventorySlotQuantityFx } from "~/inventory/consumeInventorySlotQuantityFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";

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
)(function* ({
	itemId,
	quantity,
	scope,
}: {
	itemId: string;
	quantity: number;
	scope: BoardMemoryActivationScope;
}) {
	const { nextSave } = scope;
	const slotIndex = nextSave.inventory.slots.findIndex(
		(slot) => isGameSaveInventoryStack(slot) && slot.itemId === itemId && slot.quantity > 0,
	);
	if (slotIndex < 0) return undefined;

	const consumed = yield* consumeInventorySlotQuantityFx({
		nextSave,
		quantity,
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

export const consumeInventoryItemForMemoryRestoreFx = Effect.fn(
	"consumeInventoryItemForMemoryRestoreFx",
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
					quantity: memoryItem.quantity ?? 1,
					scope,
				}))
	);
});
