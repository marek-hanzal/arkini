import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export const boardItemMatchesBoardMemoryCell = ({
	boardItem,
	memoryItem,
}: {
	boardItem: GameSaveBoardItem;
	memoryItem: BoardMemoryLayoutItem;
}) => boardItem.x === memoryItem.x && boardItem.y === memoryItem.y;
