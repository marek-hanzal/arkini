import { memo, type FC } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { useBoardCellController } from "~/board/hook/useBoardCellController";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { cn } from "~/shared/cn";

export namespace BoardCell {
	export interface Props {
		x: number;
		y: number;
		boardItem?: BoardViewItem;
		canMerge: boolean;
		showDelayedMergeHint: boolean;
		invalid: boolean;
		merged: boolean;
		imprinted: boolean;
		isOver: boolean;
	}
}

export const BoardCell: FC<BoardCell.Props> = memo((props) => {
	const cell = useBoardCellController(props);

	return (
		<div
			ref={cell.cellRef}
			data-board-cell={`${props.x}:${props.y}`}
			data-board-cell-item-id={props.boardItem?.id}
			data-producer-ready={cell.producerReady ? "true" : undefined}
			className={cn(
				"relative aspect-square touch-none border-b border-r border-slate-800/65 bg-slate-900/45",
				props.x === boardColumns - 1 && "border-r-0",
				props.y === boardRows - 1 && "border-b-0",
				props.isOver && !cell.showMergeHint && "bg-slate-800/80",
				cell.producerReady && !cell.showMergeHint && !props.invalid && "ak-producer-ready",
				cell.showMergeHint && "ak-merge-target",
				cell.showMergeHint && props.isOver && "ak-merge-target-over",
				props.invalid && "ak-cell-error",
			)}
		>
			<BoardCellProgress progress={props.boardItem?.craft?.progress} />
			<BoardCellCooldownProgress progress={cell.producerCooldown?.progress} />
		</div>
	);
});
