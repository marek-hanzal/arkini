import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
		if (boardItem.itemId === itemId) count += 1;
	}

	return count;
};
