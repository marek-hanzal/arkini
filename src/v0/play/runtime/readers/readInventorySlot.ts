import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import { readRuntimeInventorySlotFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeInventorySlotFromGameSave";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readInventorySlot = ({
	slotIndex,
	state,
}: {
	slotIndex: number;
	state: GameRuntimeState;
}): InventorySlot =>
	readRuntimeInventorySlotFromGameSave({
		save: state.runtime.save,
		slotIndex,
	});
