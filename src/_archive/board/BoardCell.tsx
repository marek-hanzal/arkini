import { memo } from "react";
import type { BoardCellView } from "~/board/boardCells";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { cn } from "~/ui/cn";

export namespace BoardCell {
	export interface Props {
		cell: BoardCellView;
		invalid: boolean;
		feedbackVariant?: TileEngine.DropFeedbackVariant;
		statusVariant?: TileEngine.DropFeedbackVariant;
	}
}

export const readBoardCellBackgroundClassName = (cell: BoardCellView): string =>
	(cell.x + cell.y) % 2 === 0 ? "bg-[rgba(255,255,255,0.58)]" : "bg-[rgba(255,229,247,0.46)]";

const cellFeedbackClassName = (variant: TileEngine.DropFeedbackVariant | undefined): string => {
	if (variant === "secondary") return "bg-ak-success/20 opacity-100 outline-ak-success/30";
	if (variant === "subtle") return "bg-ak-secondary/20 opacity-100 outline-ak-secondary/30";
	if (variant === "danger") return "bg-ak-danger/20 opacity-100 outline-ak-danger/35";
	if (variant === "primary") return "bg-pink-400/20 opacity-100 outline-ak-primary/40";

	return "opacity-0";
};

export const BoardCell = memo(
	({ cell, feedbackVariant, invalid, statusVariant }: BoardCell.Props) => (
		<div
			data-ui="board cell"
			data-ak-board-cell={`${cell.x}:${cell.y}`}
			data-ak-board-cell-feedback={feedbackVariant}
			data-ak-board-cell-status={statusVariant}
			data-ak-cell-invalid={invalid ? "true" : undefined}
			className={cn(
				"relative aspect-square touch-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.70),inset_0_0_0_2px_rgba(168,85,247,0.06)]",
				readBoardCellBackgroundClassName(cell),
				invalid &&
					"bg-ak-danger/15 outline outline-1 -outline-offset-1 outline-ak-danger/35",
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-[0.12rem] rounded-[0.12rem] outline outline-1 -outline-offset-1 outline-transparent transition-[opacity,background-color,outline-color] duration-300 ease-out",
					statusVariant && "bg-ak-danger/15 opacity-100 outline-ak-danger/30",
					!statusVariant && "opacity-0",
				)}
			/>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-[0.12rem] rounded-[0.12rem] outline outline-1 -outline-offset-1 outline-transparent transition-[opacity,background-color,outline-color] duration-300 ease-out",
					cellFeedbackClassName(feedbackVariant),
				)}
			/>
		</div>
	),
);
