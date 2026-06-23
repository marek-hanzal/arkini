import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";

export namespace readGameSaveItemQuantityByScope {
	export interface Props {
		itemId: string;
		save: GameSave;
		scope: GamePassiveRequirementScope;
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
			if (item.itemId === itemId) quantity += 1;
		}
	}

	if (scope === "inventory" || scope === "board_or_inventory") {
		for (const slot of save.inventory.slots) {
			if (slot?.itemId === itemId) quantity += readGameSaveInventorySlotQuantity(slot);
		}
	}

	return quantity;
};
