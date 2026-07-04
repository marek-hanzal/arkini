import { Effect } from "effect";
import type { GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { isGameSaveInventoryStack } from "~/inventory/model/GameSaveInventorySlot";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { pushInventoryItemCreatedEventFx } from "~/placement/pushInventoryItemCreatedEventFx";

type InventoryRemainderPlacementItem = Omit<GameSaveItemPlacementRequest, "reason"> & {
	reason?: GameSaveItemPlacementRequest["reason"];
};

export namespace placeGameSaveInventoryRemainderFx {
	export interface Props {
		createdAtMs?: number;
		events: GameEvent[];
		item: InventoryRemainderPlacementItem;
		maxStackSize: number;
		remainingQuantity: number;
		slots: GameSaveInventorySlot[];
	}
}

const pushInventoryStackPlacementEventFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.pushInventoryStackPlacementEventFx",
)(function* ({
	nextQuantity,
	placedQuantity,
	previousQuantity,
	props,
	slotIndex,
}: {
	nextQuantity: number;
	placedQuantity: number;
	previousQuantity: number;
	props: placeGameSaveInventoryRemainderFx.Props;
	slotIndex: number;
}) {
	if (!props.item.reason) return;
	yield* pushInventoryItemCreatedEventFx({
		events: props.events,
		itemId: props.item.itemId,
		nextQuantity,
		originItemInstanceId: props.item.originItemInstanceId,
		previousQuantity,
		quantity: placedQuantity,
		reason: props.item.reason,
		slotIndex,
	});
});

const placeIntoExistingInventoryStacksFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.placeIntoExistingInventoryStacksFx",
)(function* ({
	props,
	remainingQuantity,
}: {
	props: placeGameSaveInventoryRemainderFx.Props;
	remainingQuantity: number;
}) {
	let remaining = remainingQuantity;

	for (let slotIndex = 0; slotIndex < props.slots.length && remaining > 0; slotIndex += 1) {
		const slot = props.slots[slotIndex];
		if (
			!isGameSaveInventoryStack(slot) ||
			slot.itemId !== props.item.itemId ||
			slot.quantity >= props.maxStackSize
		) {
			continue;
		}

		const previousQuantity = slot.quantity;
		const placedQuantity = Math.min(props.maxStackSize - previousQuantity, remaining);
		slot.quantity += placedQuantity;
		remaining -= placedQuantity;
		yield* pushInventoryStackPlacementEventFx({
			nextQuantity: slot.quantity,
			placedQuantity,
			previousQuantity,
			props,
			slotIndex,
		});
	}

	return remaining;
});

const placeIntoEmptyInventorySlotsFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.placeIntoEmptyInventorySlotsFx",
)(function* ({
	props,
	remainingQuantity,
}: {
	props: placeGameSaveInventoryRemainderFx.Props;
	remainingQuantity: number;
}) {
	let remaining = remainingQuantity;

	for (let slotIndex = 0; slotIndex < props.slots.length && remaining > 0; slotIndex += 1) {
		if (props.slots[slotIndex]) {
			continue;
		}

		const placedQuantity = Math.min(props.maxStackSize, remaining);
		props.slots[slotIndex] = {
			...(props.createdAtMs !== undefined
				? {
						createdAtMs: props.createdAtMs,
					}
				: {}),
			itemId: props.item.itemId,
			quantity: placedQuantity,
		};
		remaining -= placedQuantity;
		yield* pushInventoryStackPlacementEventFx({
			nextQuantity: placedQuantity,
			placedQuantity,
			previousQuantity: 0,
			props,
			slotIndex,
		});
	}

	return remaining;
});

export const placeGameSaveInventoryRemainderFx = Effect.fn("placeGameSaveInventoryRemainderFx")(
	function* (props: placeGameSaveInventoryRemainderFx.Props) {
		const remainingAfterExistingStacks = yield* placeIntoExistingInventoryStacksFx({
			props,
			remainingQuantity: props.remainingQuantity,
		});
		const remainingAfterEmptySlots = yield* placeIntoEmptyInventorySlotsFx({
			props,
			remainingQuantity: remainingAfterExistingStacks,
		});
		return remainingAfterEmptySlots === 0;
	},
);
