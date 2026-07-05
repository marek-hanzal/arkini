import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readBoardItemCount {
	export interface Props {
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		itemId: string;
		save: GameSave;
	}
}

export const readBoardItemCount = ({
	ignoredBoardItemInstanceIds = new Set(),
	itemId,
	save,
}: readBoardItemCount.Props) => {
	let count = 0;

	for (const boardItem of Object.values(save.board.items)) {
		if (ignoredBoardItemInstanceIds.has(boardItem.id)) continue;
		if (boardItem.itemId === itemId) count += readGameSaveBoardItemQuantity(boardItem);
	}

	return count;
};
