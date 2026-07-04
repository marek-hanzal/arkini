import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { ItemId } from "~/config/GameIdSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";

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
