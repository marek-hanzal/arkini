import { type FC, type ReactNode, useRef } from "react";
import {
	boardCellNodeId,
	boardColumns,
	type BoardCell as BoardCellModel,
	boardRows,
} from "~/board/boardIdentity";
import { useGsapCellFeedback } from "~/board/hook/useGsapCellFeedback";
import { DroppableSurface } from "~/drag/ui/DragSurface";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { GameDropData } from "~/play/types";
import { cn } from "~/shared/cn";
import { usePressActions } from "~/shared/hook/usePressActions";

export namespace BoardCell {
	export interface Props {
		x: number;
		y: number;
		boardItem?: BoardViewItem;
		canMerge: boolean;
		showDelayedMergeHint: boolean;
		producerReady: boolean;
		invalid: boolean;
		merged: boolean;
		children: ReactNode;
		onEmptyDoubleActivate(cell: BoardCellModel): void;
	}
}

export const BoardCell: FC<BoardCell.Props> = ({
	x,
	y,
	boardItem,
	canMerge,
	showDelayedMergeHint,
	producerReady,
	invalid,
	merged,
	children,
	onEmptyDoubleActivate,
}) => {
	const id = boardCellNodeId(x, y);
	const cellRef = useRef<HTMLDivElement | null>(null);
	const press = usePressActions({
		onDouble: () => {
			if (!boardItem) {
				onEmptyDoubleActivate({
					x,
					y,
				});
			}
		},
	});
	useGsapCellFeedback(cellRef, {
		invalid,
		success: merged,
	});

	return (
		<DroppableSurface
			id={id}
			nodeId={id}
			payload={
				{
					targetId: id,
					targetNodeId: id,
					target: {
						kind: "cell",
						x,
						y,
						boardItemId: boardItem?.id,
					},
				} satisfies GameDropData
			}
			nodeRef={(node) => {
				cellRef.current = node;
			}}
			data-board-cell={`${x}:${y}`}
			data-board-item-id={boardItem?.id}
			data-producer-ready={producerReady ? "true" : undefined}
			className={(isOver) => {
				const showMergeHint = canMerge && (showDelayedMergeHint || isOver);

				return cn(
					"relative aspect-square touch-none border-b border-r border-slate-800/65 bg-slate-900/45",
					x === boardColumns - 1 && "border-r-0",
					y === boardRows - 1 && "border-b-0",
					isOver && !showMergeHint && "bg-slate-800/80",
					showMergeHint && "ak-merge-target",
					showMergeHint && isOver && "ak-merge-target-over",
					invalid && "ak-cell-error",
				);
			}}
			{...press.pressProps}
		>
			{children}
		</DroppableSurface>
	);
};
