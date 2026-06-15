import { memo, type FC, useMemo, useRef } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { useMotionCellFeedback } from "~/board/hook/useMotionCellFeedback";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import type { BoardViewItem } from "~/play/logic/playTypes";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { useProducerReadySignals } from "~/producer/hook/useProducerReadySignals";
import { isProducerReady } from "~/producer/logic/isProducerReady";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";
import { cn } from "~/shared/cn";

const emptyBoardItems: readonly BoardViewItem[] = [];

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

export const BoardCell: FC<BoardCell.Props> = memo(
	({ x, y, boardItem, canMerge, showDelayedMergeHint, invalid, merged, imprinted, isOver }) => {
		const cellRef = useRef<HTMLDivElement | null>(null);
		const clockItems = useMemo(
			() =>
				boardItem
					? [
							boardItem,
						]
					: emptyBoardItems,
			[
				boardItem,
			],
		);
		const nowMs = useProducerClock(clockItems);
		useProducerReadySignals(clockItems, nowMs);
		const producerReady = isProducerReady(boardItem?.activation, nowMs);
		const producerCooldown = readProducerCooldown({
			activation: boardItem?.activation,
			nowMs,
		});
		useMotionCellFeedback(cellRef, {
			invalid,
			success: merged,
			imprint: imprinted,
		});

		const showMergeHint = canMerge && (showDelayedMergeHint || isOver);

		return (
			<div
				ref={cellRef}
				data-board-cell={`${x}:${y}`}
				data-board-cell-item-id={boardItem?.id}
				data-producer-ready={producerReady ? "true" : undefined}
				className={cn(
					"relative aspect-square touch-none border-b border-r border-slate-800/65 bg-slate-900/45",
					x === boardColumns - 1 && "border-r-0",
					y === boardRows - 1 && "border-b-0",
					isOver && !showMergeHint && "bg-slate-800/80",
					producerReady && !showMergeHint && !invalid && "ak-producer-ready",
					showMergeHint && "ak-merge-target",
					showMergeHint && isOver && "ak-merge-target-over",
					invalid && "ak-cell-error",
				)}
			>
				<BoardCellProgress progress={boardItem?.craft?.progress} />
				<BoardCellCooldownProgress progress={producerCooldown?.progress} />
			</div>
		);
	},
);
