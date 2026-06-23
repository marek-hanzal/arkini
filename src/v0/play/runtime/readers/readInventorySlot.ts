import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/inventory/GameSaveInventorySlot";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readInventorySlot = ({
	slotIndex,
	state,
}: {
	slotIndex: number;
	state: GameRuntimeState;
}): InventorySlot => {
	const stack = state.runtime.save.inventory.slots[slotIndex];

	return {
		slotIndex,
		stack: stack
			? {
					id: isGameSaveInventoryInstance(stack)
						? stack.id
						: `runtime:inventory:${slotIndex}:${stack.itemId}`,
					itemId: stack.itemId as ItemId,
					quantity: readGameSaveInventorySlotQuantity(stack),
				}
			: undefined,
	};
};
