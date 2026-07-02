import { isBoardItemConsumableAsInput } from "~/activation/isBoardItemConsumableAsInput";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/inventory/logic/GameSaveInventorySlot";

export namespace readRuntimeActivationInputAvailableQuantityFromGameSave {
	export interface Props {
		itemId: string;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readRuntimeActivationInputAvailableQuantityFromGameSave = ({
	itemId,
	save,
	targetItemInstanceId,
}: readRuntimeActivationInputAvailableQuantityFromGameSave.Props) => {
	const boardQuantity = Object.values(save.board.items).filter(
		(item) =>
			item.id !== targetItemInstanceId &&
			item.itemId === itemId &&
			isBoardItemConsumableAsInput({
				itemInstanceId: item.id,
				save,
			}),
	).length;
	const inventoryQuantity = save.inventory.slots.reduce((total, slot) => {
		if (!slot || slot.itemId !== itemId) return total;
		return total + readGameSaveInventorySlotQuantity(slot);
	}, 0);

	return boardQuantity + inventoryQuantity;
};
