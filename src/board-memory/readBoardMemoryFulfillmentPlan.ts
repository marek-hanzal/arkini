import { boardItemMatchesBoardMemoryIdentity } from "~/board-memory/boardItemMatchesBoardMemoryIdentity";
import { boardItemMatchesBoardMemoryLayoutItem } from "~/board-memory/boardItemMatchesBoardMemoryLayoutItem";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace BoardMemoryFulfillmentPlan {
	export interface Type {
		preservedBoardItemInstanceIds: Set<string>;
		restoredIndexes: Set<number>;
	}
}

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
		const restoredBoardItem = boardItems.find(
			(candidate) =>
				!preservedBoardItemInstanceIds.has(candidate.id) &&
				boardItemMatchesBoardMemoryLayoutItem({
					boardItem: candidate,
					memoryItem,
				}),
		);
		if (restoredBoardItem) {
			preservedBoardItemInstanceIds.add(restoredBoardItem.id);
			restoredIndexes.add(index);
			continue;
		}

		if (!memoryItem.itemInstanceId) continue;
		const movableBoardItem = boardItems.find(
			(candidate) =>
				!preservedBoardItemInstanceIds.has(candidate.id) &&
				boardItemMatchesBoardMemoryIdentity({
					boardItem: candidate,
					memoryItem,
				}),
		);
		if (!movableBoardItem) continue;

		preservedBoardItemInstanceIds.add(movableBoardItem.id);
	}

	return {
		preservedBoardItemInstanceIds,
		restoredIndexes,
	};
};
