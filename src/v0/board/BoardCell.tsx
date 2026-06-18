import { memo } from "react";
import { boardColumns } from "~/v0/board/boardColumns";
import { boardRows } from "~/v0/board/boardRows";
import type { BoardCellView } from "~/v0/board/boardCells";
import { cn } from "~/v0/ui/cn";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace BoardCell {
	export interface Props {
		cell: BoardCellView;
		invalid: boolean;
		feedbackVariant?: TileEngine.DropFeedbackVariant;
		statusVariant?: TileEngine.DropFeedbackVariant;
	}
}

export const BoardCell = memo(
	({ cell, feedbackVariant, invalid, statusVariant }: BoardCell.Props) => (
		<div
			data-ui="board cell"
			data-ak-board-cell={`${cell.x}:${cell.y}`}
			data-ak-board-cell-feedback={feedbackVariant}
			data-ak-board-cell-status={statusVariant}
			className={cn(
				"relative aspect-square touch-none border-b border-r border-pink-200/70 bg-white/58",
				cell.x === boardColumns - 1 && "border-r-0",
				cell.y === boardRows - 1 && "border-b-0",
				feedbackVariant && "ak-cell-feedback",
				statusVariant && "ak-cell-status",
				invalid && "ak-cell-error",
			)}
		/>
	),
);
