import type {
	GameSaveInventoryInstance,
	GameSaveInventorySlot,
	GameSaveInventoryStack,
} from "~/v0/game/engine/model/GameSaveSchema";

export const isGameSaveInventoryInstance = (
	slot: GameSaveInventorySlot,
): slot is GameSaveInventoryInstance => Boolean(slot && "kind" in slot && slot.kind === "instance");

export const isGameSaveInventoryStack = (
	slot: GameSaveInventorySlot,
): slot is GameSaveInventoryStack => Boolean(slot && !("kind" in slot));

export const readGameSaveInventorySlotQuantity = (slot: GameSaveInventorySlot): number => {
	if (!slot) return 0;
	return isGameSaveInventoryInstance(slot) ? 1 : slot.quantity;
};
