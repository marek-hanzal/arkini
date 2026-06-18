import { memo } from "react";
import type { BoardCellView } from "~/v0/board/boardCells";
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
			data-ak-cell-invalid={invalid ? "true" : undefined}
			className="relative aspect-square touch-none bg-white/78"
		/>
	),
);
