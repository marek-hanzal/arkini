import { boardItemMatchesBoardMemoryCell } from "~/board-memory/boardItemMatchesBoardMemoryCell";
import { boardItemMatchesBoardMemoryIdentity } from "~/board-memory/boardItemMatchesBoardMemoryIdentity";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export const boardItemMatchesBoardMemoryLayoutItem = ({
	boardItem,
	memoryItem,
}: {
	boardItem: GameSaveBoardItem;
	memoryItem: BoardMemoryLayoutItem;
}) =>
	boardItemMatchesBoardMemoryIdentity({
		boardItem,
		memoryItem,
	}) &&
	boardItemMatchesBoardMemoryCell({
		boardItem,
		memoryItem,
	});
