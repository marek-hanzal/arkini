import { memo } from "react";
import { boardColumns } from "~/v0/board/boardColumns";
import { boardRows } from "~/v0/board/boardRows";
import type { BoardCellView } from "~/v0/board/boardCells";
import { cn } from "~/v0/ui/cn";

export namespace BoardCell {
	export interface Props {
		cell: BoardCellView;
		invalid: boolean;
	}
}

export const BoardCell = memo(({ cell, invalid }: BoardCell.Props) => (
	<div
		data-ak-board-cell={`${cell.x}:${cell.y}`}
		className={cn(
			"relative aspect-square touch-none border-b border-r border-slate-800/65 bg-slate-900/45",
			cell.x === boardColumns - 1 && "border-r-0",
			cell.y === boardRows - 1 && "border-b-0",
			invalid && "ak-cell-error",
		)}
	/>
));
