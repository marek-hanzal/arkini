import { boardColumns } from "~/v0/board/boardColumns";
import { boardRows } from "~/v0/board/boardRows";
import { cellKey } from "~/v0/board/util/cell";

export const boardCells = Array.from(
	{
		length: boardColumns * boardRows,
	},
	(_, index) => ({
		x: index % boardColumns,
		y: Math.floor(index / boardColumns),
		key: cellKey(index % boardColumns, Math.floor(index / boardColumns)),
	}),
);

export type BoardCellView = (typeof boardCells)[number];
