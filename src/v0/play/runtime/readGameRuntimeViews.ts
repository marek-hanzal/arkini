import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import { readRuntimeInventoryViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/v0/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readGameRuntimeBoardView = (state: GameRuntimeState): BoardView =>
	readRuntimeBoardViewFromGameSave({
		config: state.runtime.config,
		nowMs: state.nowMs,
		save: state.runtime.save,
	});

export const readGameRuntimeInventoryView = (state: GameRuntimeState): InventoryView =>
	readRuntimeInventoryViewFromGameSave({
		config: state.runtime.config,
		save: state.runtime.save,
	});

export const readGameRuntimeItemCatalogView = (state: GameRuntimeState): ItemCatalogView =>
	readRuntimeItemCatalogViewFromGameConfig(state.runtime.config);
