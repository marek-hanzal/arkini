import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readGameSaveOwnedItemQuantity {
	export interface Props {
		itemId: string;
		save: GameSave;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
	}
}

export const readGameSaveOwnedItemQuantity = ({
	ignoredBoardItemInstanceIds = new Set(),
	itemId,
	save,
}: readGameSaveOwnedItemQuantity.Props) => {
	let quantity = 0;

	for (const boardItem of Object.values(save.board.items)) {
		if (ignoredBoardItemInstanceIds.has(boardItem.id)) continue;
		if (boardItem.itemId === itemId) quantity += 1;
	}

	for (const slot of save.inventory.slots) {
		if (slot?.itemId === itemId) quantity += readGameSaveInventorySlotQuantity(slot);
	}

	for (const producerState of Object.values(save.producerInputs)) {
		for (const productInputState of Object.values(producerState.productInputs)) {
			quantity += productInputState.items[itemId] ?? 0;
		}
	}

	for (const craftState of Object.values(save.craftInputs)) {
		quantity += craftState.items[itemId] ?? 0;
	}

	for (const stashInputState of Object.values(save.stashInputs)) {
		quantity += stashInputState.items[itemId] ?? 0;
	}

	for (const storedRequirementState of Object.values(save.storedRequirements)) {
		quantity += storedRequirementState.items[itemId] ?? 0;
	}

	return quantity;
};
