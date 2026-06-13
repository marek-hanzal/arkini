import { type FC, useMemo } from "react";
import {
	boardColumns,
	boardContainerNodeId,
	type BoardCell as BoardCellModel,
	boardRows,
	boardSourceId,
} from "~/board/boardIdentity";
import { useDelayedMergeHints } from "~/board/hook/useDelayedMergeHints";
import { BoardCell } from "~/board/ui/BoardCell";
import { BoardTile } from "~/board/ui/BoardTile";
import { cellKey } from "~/board/util/cell";
import type { ItemId } from "~/manifest/data/manifestId";
import { resolveItemMergeRule } from "~/manifest/logic/resolveItemMergeRule";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { GameDragData } from "~/play/types";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { useProducerReadySignals } from "~/producer/hook/useProducerReadySignals";
import { isProducerReady } from "~/producer/logic/isProducerReady";

export namespace Board {
	export interface DragState {
		activeDrag?: GameDragData;
		isSourceHidden(sourceId: string): boolean;
	}

	export interface FeedbackState {
		invalidCellKey?: string;
		mergedCellKey?: string;
	}

	export interface Actions {
		emptyDoubleActivate(cell: BoardCellModel): void;
		tileSingleActivate(item: BoardViewItem): void;
		tileDoubleActivate(item: BoardViewItem): void;
	}

	export interface Props {
		drag: DragState;
		feedback: FeedbackState;
		actions: Actions;
	}
}

export const Board: FC<Board.Props> = ({ drag, feedback, actions }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const cells = useMemo(
		() =>
			Array.from(
				{
					length: boardColumns * boardRows,
				},
				(_, index) => ({
					x: index % boardColumns,
					y: Math.floor(index / boardColumns),
				}),
			),
		[],
	);
	const showDelayedMergeHints = useDelayedMergeHints({
		activeDrag: drag.activeDrag ?? undefined,
	});
	const nowMs = useProducerClock(board?.items ?? []);
	useProducerReadySignals(board?.items ?? [], nowMs);

	if (!board || !items) return null;

	return (
		<div
			data-drag-boundary-id={boardContainerNodeId}
			className="grid w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
			style={{
				gridTemplateColumns: `repeat(${boardColumns}, minmax(0, 1fr))`,
			}}
		>
			{cells.map((cell) => {
				const key = cellKey(cell.x, cell.y);
				const boardItem = board.byCellKey[key];
				const viewItem = boardItem ? items[boardItem.itemId] : undefined;
				const canMerge =
					drag.activeDrag?.source.kind === "board" &&
					boardItem !== undefined &&
					boardItem.id !== drag.activeDrag.source.boardItemId
						? Boolean(
								resolveItemMergeRule(
									drag.activeDrag.itemId as ItemId,
									boardItem.itemId as ItemId,
								),
							) ||
							Boolean(
								boardItem.craft?.acceptedInputItemIds.includes(
									drag.activeDrag.itemId,
								),
							) ||
							Boolean(
								boardItem.producer?.inputs.some(
									(input) =>
										input.itemId === drag.activeDrag?.itemId &&
										input.stored < input.capacity,
								),
							)
						: false;
				return (
					<BoardCell
						key={key}
						x={cell.x}
						y={cell.y}
						boardItem={boardItem}
						canMerge={canMerge}
						showDelayedMergeHint={showDelayedMergeHints}
						producerReady={isProducerReady(boardItem?.producer, nowMs)}
						craftProgress={boardItem?.craft?.progress}
						invalid={feedback.invalidCellKey === key}
						merged={feedback.mergedCellKey === key}
						onEmptyDoubleActivate={actions.emptyDoubleActivate}
					>
						{boardItem && viewItem ? (
							<BoardTile
								boardItem={boardItem}
								item={viewItem}
								nowMs={nowMs}
								hidden={drag.isSourceHidden(boardSourceId(boardItem.id))}
								onSingleActivate={() => actions.tileSingleActivate(boardItem)}
								onDoubleActivate={() => actions.tileDoubleActivate(boardItem)}
							/>
						) : null}
					</BoardCell>
				);
			})}
		</div>
	);
};
