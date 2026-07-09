import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveShapeSchema";

export const readBoardItemStackCapacity = ({
	config,
	item,
}: {
	config: GameConfig;
	item: GameSaveBoardItem;
}) => {
	const itemDefinition = config.items[item.itemId];
	if (!itemDefinition || itemDefinition.maxStackSize <= 1) return 0;

	return Math.max(0, itemDefinition.maxStackSize - readGameSaveBoardItemQuantity(item));
};
