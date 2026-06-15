import { memo } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import type { BoardCellView } from "~/board/boardCells";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { isProducerReady } from "~/producer/logic/isProducerReady";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";
import { cn } from "~/shared/cn";

export namespace BoardCell {
	export interface Props {
		cell: BoardCellView;
		boardItem?: BoardViewItem;
		invalid: boolean;
		merged: boolean;
		imprinted: boolean;
		isOver: boolean;
		nowMs: number;
	}
}

export const BoardCell = memo(
	({ cell, boardItem, invalid, merged, imprinted, isOver, nowMs }: BoardCell.Props) => {
		const producerReady = isProducerReady(boardItem?.activation, nowMs);
		const producerCooldown = readProducerCooldown({
			activation: boardItem?.activation,
			nowMs,
		});

		return (
			<div
				data-ak-board-cell={`${cell.x}:${cell.y}`}
				data-ak-board-cell-item-id={boardItem?.id}
				className={cn(
					"relative aspect-square touch-none border-b border-r border-slate-800/65 bg-slate-900/45",
					cell.x === boardColumns - 1 && "border-r-0",
					cell.y === boardRows - 1 && "border-b-0",
					isOver &&
						"bg-slate-800/80 outline outline-2 -outline-offset-2 outline-emerald-300/80",
					producerReady && !invalid && "ak-producer-ready",
					invalid && "ak-cell-error",
					merged && "ak-merge-target-over",
					imprinted && "ak-merge-target",
				)}
			>
				<BoardCellProgress progress={boardItem?.craft?.progress} />
				<BoardCellCooldownProgress progress={producerCooldown?.progress} />
			</div>
		);
	},
);
