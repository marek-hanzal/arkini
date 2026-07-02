import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

export const readItemCatalogView = (state: GameRuntimeState): ItemCatalogView =>
	readRuntimeItemCatalogViewFromGameConfig(state.runtime.config);
