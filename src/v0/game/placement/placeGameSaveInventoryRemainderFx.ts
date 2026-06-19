import { Effect } from "effect";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import { isGameSaveInventoryStack } from "~/v0/game/engine/model/GameSaveInventorySlot";
import type { GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeGameSaveInventoryRemainderFx {
	export interface Props {
		events: GameEvent[];
		item: GameSaveItemPlacementRequest;
		maxStackSize: number;
		remainingQuantity: number;
		slots: GameSaveInventorySlot[];
	}
}

export const placeGameSaveInventoryRemainderFx = Effect.fn("placeGameSaveInventoryRemainderFx")(
	function* ({
		events,
		item,
		maxStackSize,
		remainingQuantity,
		slots,
	}: placeGameSaveInventoryRemainderFx.Props) {
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

			const placedQuantity = Math.min(maxStackSize - slot.quantity, remaining);
			const previousQuantity = slot.quantity;
			slot.quantity += placedQuantity;
			remaining -= placedQuantity;
			events.push({
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				reason: item.reason,
				to: {
					kind: "inventory",
					nextQuantity: slot.quantity,
					previousQuantity,
					quantity: placedQuantity,
					slotIndex,
				},
				type: "item.created",
			});
		}

		for (let slotIndex = 0; slotIndex < slots.length && remaining > 0; slotIndex += 1) {
			if (slots[slotIndex]) {
				continue;
			}

			const placedQuantity = Math.min(maxStackSize, remaining);
			slots[slotIndex] = {
				itemId: item.itemId,
				quantity: placedQuantity,
			};
			remaining -= placedQuantity;
			events.push({
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				reason: item.reason,
				to: {
					kind: "inventory",
					nextQuantity: placedQuantity,
					previousQuantity: 0,
					quantity: placedQuantity,
					slotIndex,
				},
				type: "item.created",
			});
		}

		return remaining === 0;
	},
);
