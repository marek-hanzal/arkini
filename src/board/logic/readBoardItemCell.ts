import type { BoardCell } from "~/board/logic/BoardCell";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export const readBoardItemCell = ({
	itemInstanceId,
	save,
}: {
	itemInstanceId?: string;
	save: GameSave;
}): BoardCell | undefined => {
	if (!itemInstanceId) {
		return undefined;
	}

	const item = save.board.items[itemInstanceId];
	if (!item) {
		return undefined;
	}

	return {
		x: item.x,
		y: item.y,
	};
};
