import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { cellKey } from "~/board/util/cell";

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
