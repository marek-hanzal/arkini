import { boardItemMatchesBoardMemoryLayoutItem } from "~/board-memory/boardItemMatchesBoardMemoryLayoutItem";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace BoardMemoryFulfillmentPlan {
	export interface Type {
		preservedBoardItemInstanceIds: Set<string>;
		restoredIndexes: Set<number>;
	}
}

export const readBoardMemoryFulfillmentPlan = ({
	config,
	save,
	savedItems,
}: {
	config: GameConfig;
	save: GameSave;
	savedItems: readonly BoardMemoryLayoutItem[];
}): BoardMemoryFulfillmentPlan.Type => {
	const preservedBoardItemInstanceIds = new Set<string>();
	const restoredIndexes = new Set<number>();
	const boardItems = Object.values(save.board.items);

	for (const [index, memoryItem] of savedItems.entries()) {
		if (
			isItemStorageAllowed({
				config,
				itemId: memoryItem.itemId,
				location: "inventory",
			})
		) {
			continue;
		}

		const boardItem = boardItems.find(
			(candidate) =>
				!preservedBoardItemInstanceIds.has(candidate.id) &&
				boardItemMatchesBoardMemoryLayoutItem({
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
