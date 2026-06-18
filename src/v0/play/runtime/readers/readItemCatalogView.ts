import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/v0/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readItemCatalogView = (state: GameRuntimeState): ItemCatalogView =>
	readRuntimeItemCatalogViewFromGameConfig(state.runtime.config);
