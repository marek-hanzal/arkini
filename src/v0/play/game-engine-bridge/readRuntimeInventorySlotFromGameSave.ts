import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/inventory/GameSaveInventorySlot";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";

export namespace readRuntimeInventorySlotFromGameSave {
	export interface Props {
		save: GameSave;
		slotIndex: number;
	}
}

export const readRuntimeInventorySlotFromGameSave = ({
	save,
	slotIndex,
}: readRuntimeInventorySlotFromGameSave.Props): InventorySlot => {
	const stack = save.inventory.slots[slotIndex];

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
