import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/engine/model/GameSaveInventorySlot";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

const emptyStateJson = "{}";

export const readGameRuntimeInventorySlot = ({
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
					state: {},
					stateful: isGameSaveInventoryInstance(stack),
					stateJson: emptyStateJson,
				}
			: undefined,
	};
};
