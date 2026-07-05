import { isBoardItemConsumableAsInput } from "~/activation/isBoardItemConsumableAsInput";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/inventory/model/GameSaveInventorySlot";

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
	const boardQuantity = Object.values(save.board.items).reduce((total, item) => {
		if (item.id === targetItemInstanceId || item.itemId !== itemId) return total;
		if (
			!isBoardItemConsumableAsInput({
				itemInstanceId: item.id,
				save,
			})
		) {
			return total;
		}
		return total + readGameSaveBoardItemQuantity(item);
	}, 0);
	const inventoryQuantity = save.inventory.slots.reduce((total, slot) => {
		if (!slot || slot.itemId !== itemId) return total;
		return total + readGameSaveInventorySlotQuantity(slot);
	}, 0);

	return boardQuantity + inventoryQuantity;
};
