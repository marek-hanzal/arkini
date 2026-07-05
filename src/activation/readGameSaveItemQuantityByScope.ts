import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/inventory/model/GameSaveInventorySlot";
import type { GameItemQuantityScope } from "~/activation/GameItemQuantityScope";

export namespace readGameSaveItemQuantityByScope {
	export interface Props {
		itemId: string;
		save: GameSave;
		scope: GameItemQuantityScope;
	}
}

export const readGameSaveItemQuantityByScope = ({
	itemId,
	save,
	scope,
}: readGameSaveItemQuantityByScope.Props) => {
	let quantity = 0;

	if (scope === "board" || scope === "board_or_inventory") {
		for (const item of Object.values(save.board.items)) {
			if (item.itemId === itemId) quantity += readGameSaveBoardItemQuantity(item);
		}
	}

	if (scope === "inventory" || scope === "board_or_inventory") {
		for (const slot of save.inventory.slots) {
			if (slot?.itemId === itemId) quantity += readGameSaveInventorySlotQuantity(slot);
		}
	}

	return quantity;
};
