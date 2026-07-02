import type { ViewItem } from "~/item/view/ViewItemSchema";
import type { ItemId } from "~/config/GameIdSchema";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

export const readItemView = ({
	itemId,
	state,
}: {
	itemId: ItemId | string | undefined;
	state: GameRuntimeState;
}): ViewItem | undefined =>
	itemId
		? readRuntimeItemCatalogViewFromGameConfig(state.runtime.config)[itemId as ItemId]
		: undefined;
