import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { readRuntimeInventorySlotFromGameSave } from "~/play/game-engine-bridge/readRuntimeInventorySlotFromGameSave";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

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
