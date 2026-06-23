import { isBoardItemConsumableAsInput } from "~/v0/game/requirements/isBoardItemConsumableAsInput";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";

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
