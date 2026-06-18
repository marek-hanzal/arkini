import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { readRuntimeInventoryViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readInventoryView = (state: GameRuntimeState): InventoryView =>
	readRuntimeInventoryViewFromGameSave({
		config: state.runtime.config,
		save: state.runtime.save,
	});
