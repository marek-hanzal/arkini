import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import { readBoardMemoryLayoutItemQuantity } from "~/board-memory/readBoardMemoryLayoutItemQuantity";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export const boardItemMatchesBoardMemoryIdentity = ({
	boardItem,
	memoryItem,
}: {
	boardItem: GameSaveBoardItem;
	memoryItem: BoardMemoryLayoutItem;
}) => {
	if (boardItem.itemId !== memoryItem.itemId) return false;
	if (memoryItem.itemInstanceId && boardItem.id !== memoryItem.itemInstanceId) return false;
	return (
		readGameSaveBoardItemQuantity(boardItem) === readBoardMemoryLayoutItemQuantity(memoryItem)
	);
};
