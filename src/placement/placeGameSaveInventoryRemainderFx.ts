import { Context, Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
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

class InventoryRemainderPlacementScopeFx extends Context.Tag("InventoryRemainderPlacementScopeFx")<
	InventoryRemainderPlacementScopeFx,
	placeGameSaveInventoryRemainderFx.Props
>() {
	//
}

const pushInventoryStackPlacementEventFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.pushInventoryStackPlacementEventFx",
)(function* ({
	nextQuantity,
	placedQuantity,
	previousQuantity,
	slotIndex,
}: {
	nextQuantity: number;
	placedQuantity: number;
	previousQuantity: number;
	slotIndex: number;
}) {
	const { events, item } = yield* InventoryRemainderPlacementScopeFx;
	if (!item.reason) return;
	yield* pushInventoryItemCreatedEventFx({
		events,
		itemId: item.itemId,
		nextQuantity,
		originItemInstanceId: item.originItemInstanceId,
		previousQuantity,
		quantity: placedQuantity,
		reason: item.reason,
		slotIndex,
	});
});

const placeIntoExistingInventoryStacksFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.placeIntoExistingInventoryStacksFx",
)(function* ({ remainingQuantity }: { remainingQuantity: number }) {
	const { item, maxStackSize, slots } = yield* InventoryRemainderPlacementScopeFx;
	let remaining = remainingQuantity;

	for (let slotIndex = 0; slotIndex < slots.length && remaining > 0; slotIndex += 1) {
		const slot = slots[slotIndex];
		if (
			!isGameSaveInventoryStack(slot) ||
			slot.itemId !== item.itemId ||
			slot.quantity >= maxStackSize
		) {
			continue;
		}

		const previousQuantity = slot.quantity;
		const placedQuantity = Math.min(maxStackSize - previousQuantity, remaining);
		slot.quantity += placedQuantity;
		remaining -= placedQuantity;
		yield* pushInventoryStackPlacementEventFx({
			nextQuantity: slot.quantity,
			placedQuantity,
			previousQuantity,
			slotIndex,
		});
	}

	return remaining;
});

const placeIntoEmptyInventorySlotsFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.placeIntoEmptyInventorySlotsFx",
)(function* ({ remainingQuantity }: { remainingQuantity: number }) {
	const { createdAtMs, item, maxStackSize, slots } = yield* InventoryRemainderPlacementScopeFx;
	let remaining = remainingQuantity;

	for (let slotIndex = 0; slotIndex < slots.length && remaining > 0; slotIndex += 1) {
		if (slots[slotIndex]) {
			continue;
		}

		const placedQuantity = Math.min(maxStackSize, remaining);
		slots[slotIndex] = {
			...(createdAtMs !== undefined
				? {
						createdAtMs,
					}
				: {}),
			itemId: item.itemId,
			quantity: placedQuantity,
		};
		remaining -= placedQuantity;
		yield* pushInventoryStackPlacementEventFx({
			nextQuantity: placedQuantity,
			placedQuantity,
			previousQuantity: 0,
			slotIndex,
		});
	}

	return remaining;
});

const placeInventoryRemainderProgramFx = Effect.fn(
	"placeGameSaveInventoryRemainderFx.placeInventoryRemainderProgramFx",
)(function* () {
	const { remainingQuantity } = yield* InventoryRemainderPlacementScopeFx;
	const remainingAfterExistingStacks = yield* placeIntoExistingInventoryStacksFx({
		remainingQuantity,
	});
	const remainingAfterEmptySlots = yield* placeIntoEmptyInventorySlotsFx({
		remainingQuantity: remainingAfterExistingStacks,
	});
	return remainingAfterEmptySlots === 0;
});

export const placeGameSaveInventoryRemainderFx = Effect.fn("placeGameSaveInventoryRemainderFx")(
	function* (props: placeGameSaveInventoryRemainderFx.Props) {
		return yield* placeInventoryRemainderProgramFx().pipe(
			Effect.provideService(InventoryRemainderPlacementScopeFx, props),
		);
	},
);
