import type { GameSave } from "~/engine/model/GameSaveSchema";

export const readSortedBoardMemoryBoardItems = ({ save }: { save: GameSave }) =>
	Object.values(save.board.items).sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);
