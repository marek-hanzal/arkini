import type { GameConfig } from "../GameConfig";
import type { ItemId } from "../manifestId";
import { assert } from "./assert";

export const itemByIdOrThrow = (itemIds: Set<ItemId>, config: GameConfig, itemId: ItemId) => {
	assert(itemIds.has(itemId), `Unknown item ${itemId}`);
	const item = config.items.find((candidate) => candidate.id === itemId);
	assert(item, `Unknown item ${itemId}`);
	return item;
};
