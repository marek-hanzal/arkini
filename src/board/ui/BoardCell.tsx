import { type FC, type ReactNode, useRef } from "react";
import type { BoardCell as BoardCellModel } from "~/board/BoardCell";
import { boardCellNodeId } from "~/board/boardCellNodeId";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { useGsapCellFeedback } from "~/board/hook/useGsapCellFeedback";
import { DroppableSurface } from "~/drag/ui/DroppableSurface";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { DropData } from "~/play/types";
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
		producerCooldownProgress?: number;
		craftProgress?: number;
		invalid: boolean;
		merged: boolean;
		imprinted: boolean;
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
	producerCooldownProgress,
	craftProgress,
	invalid,
	merged,
	imprinted,
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
		imprint: imprinted,
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
				} satisfies DropData
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
					producerReady && !showMergeHint && !invalid && "ak-producer-ready",
					showMergeHint && "ak-merge-target",
					showMergeHint && isOver && "ak-merge-target-over",
					invalid && "ak-cell-error",
				);
			}}
			{...press.pressProps}
		>
			<BoardCellProgress progress={craftProgress} />
			{children}
			<BoardCellCooldownProgress progress={producerCooldownProgress} />
		</DroppableSurface>
	);
};
