import { memo, type FC, useCallback, useMemo, useRef } from "react";
import { boardCellNodeId } from "~/board/boardCellNodeId";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { useMotionCellFeedback } from "~/board/hook/useMotionCellFeedback";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import { DroppableSurface } from "~/drag/ui/DroppableSurface";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { DropData } from "~/play/types";
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
	}
}

export const BoardCell: FC<BoardCell.Props> = memo(
	({ x, y, boardItem, canMerge, showDelayedMergeHint, invalid, merged, imprinted }) => {
		const id = boardCellNodeId(x, y);
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
		const payload = useMemo(
			() =>
				({
					targetId: id,
					targetNodeId: id,
					target: {
						kind: "cell" as const,
						x,
						y,
						boardItemId: boardItem?.id,
					},
				}) satisfies DropData,
			[
				boardItem?.id,
				id,
				x,
				y,
			],
		);
		const setCellNode = useCallback((node: HTMLDivElement | null) => {
			cellRef.current = node;
		}, []);
		const className = useCallback(
			(isOver: boolean) => {
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
			},
			[
				canMerge,
				invalid,
				producerReady,
				showDelayedMergeHint,
				x,
				y,
			],
		);

		return (
			<DroppableSurface
				id={id}
				nodeId={id}
				payload={payload}
				nodeRef={setCellNode}
				data-board-cell={`${x}:${y}`}
				data-board-cell-item-id={boardItem?.id}
				data-producer-ready={producerReady ? "true" : undefined}
				className={className}
			>
				<BoardCellProgress progress={boardItem?.craft?.progress} />
				<BoardCellCooldownProgress progress={producerCooldown?.progress} />
			</DroppableSurface>
		);
	},
);
