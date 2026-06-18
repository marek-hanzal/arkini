import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/v0/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readGameRuntimeItemView = ({
	itemId,
	state,
}: {
	itemId: ItemId | string | undefined;
	state: GameRuntimeState;
}): ViewItem | undefined =>
	itemId
		? readRuntimeItemCatalogViewFromGameConfig(state.runtime.config)[itemId as ItemId]
		: undefined;
