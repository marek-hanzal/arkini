import { memo, type FC } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardContainerNodeId } from "~/board/boardContainerNodeId";
import { boardRows } from "~/board/boardRows";
import { useDelayedMergeHints } from "~/board/hook/useDelayedMergeHints";
import { BoardCell } from "~/board/ui/BoardCell";
import { BoardItemLayer } from "~/board/ui/BoardItemLayer";
import { cellKey } from "~/board/util/cell";
import { resolveItemMergeRule } from "~/manifest/logic/resolveItemMergeRule";
import type { ItemId } from "~/manifest/manifestId";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { DragData } from "~/play/types";

const boardCells = Array.from(
	{
		length: boardColumns * boardRows,
	},
	(_, index) => ({
		x: index % boardColumns,
		y: Math.floor(index / boardColumns),
		key: cellKey(index % boardColumns, Math.floor(index / boardColumns)),
	}),
);
const boardGridStyle = {
	gridTemplateColumns: `repeat(${boardColumns}, minmax(0, 1fr))`,
};
export namespace Board {
	export interface DragState {
		activeDrag?: DragData;
		isSourceHidden(sourceId: string): boolean;
	}

	export interface FeedbackState {
		invalidCellKey?: string;
		mergedCellKey?: string;
		imprintedCellKey?: string;
	}

	export interface Actions {
		tileSingleActivate(item: BoardViewItem): void;
		tileLongActivate(item: BoardViewItem): void;
	}

	export interface Props {
		drag: DragState;
		feedback: FeedbackState;
		actions: Actions;
		visualMotions: useVisualItemMotions.State;
	}
}

export const Board: FC<Board.Props> = memo(({ drag, feedback, actions, visualMotions }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const showDelayedMergeHints = useDelayedMergeHints({
		activeDrag: drag.activeDrag ?? undefined,
	});
	if (!board || !items) return null;

	return (
		<div
			data-drag-boundary-id={boardContainerNodeId}
			className="relative grid w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
			style={boardGridStyle}
		>
			{boardCells.map((cell) => {
				const boardItem = board.byCellKey[cell.key];
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
								boardItem.craft?.canAcceptInputs &&
									boardItem.craft.acceptedInputItemIds.includes(
										drag.activeDrag.itemId,
									),
							) ||
							Boolean(
								boardItem.activation?.inputs.some(
									(input) =>
										input.itemId === drag.activeDrag?.itemId &&
										input.stored < input.capacity,
								),
							)
						: false;
				return (
					<BoardCell
						key={cell.key}
						x={cell.x}
						y={cell.y}
						boardItem={boardItem}
						canMerge={canMerge}
						showDelayedMergeHint={showDelayedMergeHints}
						invalid={feedback.invalidCellKey === cell.key}
						merged={feedback.mergedCellKey === cell.key}
						imprinted={feedback.imprintedCellKey === cell.key}
					/>
				);
			})}
			<BoardItemLayer
				boardItems={board.items}
				items={items}
				isSourceHidden={drag.isSourceHidden}
				visualMotions={visualMotions}
				actions={actions}
			/>
		</div>
	);
});
