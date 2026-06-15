import type { SaveShape } from "~/v0/play/save/model/SaveShape";
import { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";

export const assertInsideBoard = (save: SaveShape, x: number, y: number) => {
	const result = BoardCellSchema.safeParse({
		x,
		y,
	});
	if (!result.success || x >= save.boardWidth || y >= save.boardHeight) {
		throw new GameActionError("Target cell is outside the board.");
	}
};
