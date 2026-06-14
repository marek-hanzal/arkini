import type { SaveShape } from "~/inventory/logic/planning/types";
import { BoardCellSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";

export const assertInsideBoard = (save: SaveShape, x: number, y: number) => {
	const result = BoardCellSchema.safeParse({
		x,
		y,
	});
	if (!result.success || x >= save.boardWidth || y >= save.boardHeight) {
		throw new GameActionError("Target cell is outside the board.");
	}
};
