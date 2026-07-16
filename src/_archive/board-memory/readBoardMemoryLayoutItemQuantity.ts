import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";

export const readBoardMemoryLayoutItemQuantity = (memoryItem: BoardMemoryLayoutItem) =>
	memoryItem.quantity ?? 1;
