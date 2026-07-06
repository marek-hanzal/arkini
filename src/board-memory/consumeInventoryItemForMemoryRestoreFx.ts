import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import type { InventoryConsumedForMemoryRestore } from "~/board-memory/BoardMemoryRestoreTypes";
import type { GameEvent } from "~/event/GameEventSchema";
import { readBoardMemoryLayoutItemQuantity } from "~/board-memory/readBoardMemoryLayoutItemQuantity";
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
		consumedEvents: [
			consumed.consumedEvent,
		],
		createdAtMs: consumed.slot.createdAtMs,
		itemInstanceId: consumed.slot.id,
	} satisfies InventoryConsumedForMemoryRestore;
});

const readInventoryStackQuantity = ({
	itemId,
	scope,
}: {
	itemId: string;
	scope: BoardMemoryActivationScope;
}) =>
	scope.nextSave.inventory.slots.reduce((total, slot) => {
		if (!isGameSaveInventoryStack(slot) || slot.itemId !== itemId) return total;
		return total + slot.quantity;
	}, 0);

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
	if (
		readInventoryStackQuantity({
			itemId,
			scope,
		}) < quantity
	) {
		return undefined;
	}

	const consumedEvents: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>[] = [];
	let createdAtMs: number | undefined;
	let remainingQuantity = quantity;

	for (let slotIndex = 0; slotIndex < nextSave.inventory.slots.length; slotIndex += 1) {
		if (remainingQuantity <= 0) break;
		const slot = nextSave.inventory.slots[slotIndex];
		if (!isGameSaveInventoryStack(slot) || slot.itemId !== itemId || slot.quantity <= 0)
			continue;

		const consumedQuantity = Math.min(slot.quantity, remainingQuantity);
		const consumed = yield* consumeInventorySlotQuantityFx({
			nextSave,
			quantity: consumedQuantity,
			reason: "memory-restore",
			runtimeState: "remove-instance",
			slotIndex,
		});
		consumedEvents.push(consumed.consumedEvent);
		createdAtMs ??= consumed.slot.createdAtMs;
		remainingQuantity -= consumedQuantity;
	}

	return {
		consumedEvents,
		createdAtMs,
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
					quantity: readBoardMemoryLayoutItemQuantity(memoryItem),
					scope,
				}))
	);
});
