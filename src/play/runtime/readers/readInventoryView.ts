import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { readRuntimeInventoryViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

export const readInventoryView = (state: GameRuntimeState): InventoryView =>
	readRuntimeInventoryViewFromGameSave({
		config: state.runtime.config,
		save: state.runtime.save,
	});
