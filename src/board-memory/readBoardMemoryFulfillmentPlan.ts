import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export namespace BoardMemoryFulfillmentPlan {
	export interface Type {
		preservedBoardItemInstanceIds: Set<string>;
		restoredIndexes: Set<number>;
	}
}

const readMemoryItemQuantity = (memoryItem: BoardMemoryLayoutItem) => memoryItem.quantity ?? 1;

const boardItemMatchesMemoryItem = ({
	boardItem,
	memoryItem,
}: {
	boardItem: GameSaveBoardItem;
	memoryItem: BoardMemoryLayoutItem;
}) => {
	if (boardItem.itemId !== memoryItem.itemId) return false;
	if (boardItem.x !== memoryItem.x || boardItem.y !== memoryItem.y) return false;
	if (memoryItem.itemInstanceId && boardItem.id !== memoryItem.itemInstanceId) return false;
	return readGameSaveBoardItemQuantity(boardItem) === readMemoryItemQuantity(memoryItem);
};

export const readBoardMemoryFulfillmentPlan = ({
	save,
	savedItems,
}: {
	save: GameSave;
	savedItems: readonly BoardMemoryLayoutItem[];
}): BoardMemoryFulfillmentPlan.Type => {
	const preservedBoardItemInstanceIds = new Set<string>();
	const restoredIndexes = new Set<number>();
	const boardItems = Object.values(save.board.items);

	for (const [index, memoryItem] of savedItems.entries()) {
		const boardItem = boardItems.find(
			(candidate) =>
				!preservedBoardItemInstanceIds.has(candidate.id) &&
				boardItemMatchesMemoryItem({
					boardItem: candidate,
					memoryItem,
				}),
		);
		if (!boardItem) continue;

		preservedBoardItemInstanceIds.add(boardItem.id);
		restoredIndexes.add(index);
	}

	return {
		preservedBoardItemInstanceIds,
		restoredIndexes,
	};
};
