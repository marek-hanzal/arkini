import { memo, type ReactNode, useCallback, useRef } from "react";
import { BoardCell } from "~/v0/board/BoardCell";
import type { BoardSurface as BoardSurfaceType } from "~/v0/board/BoardSurface.types";
import { boardCells, type BoardCellView } from "~/v0/board/boardCells";
import { boardColumns } from "~/v0/board/boardColumns";
import { cellKey } from "~/v0/board/cellKey";
import { renderBoardTile } from "~/v0/board/renderBoardTile";
import { useBoardTileEngineModel } from "~/v0/board/useBoardTileEngineModel";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { useGameBoardView } from "~/v0/play/runtime";
import { TileEngine } from "~/v0/tile-engine";
import type { TileEngineNamespace as TileEngineType } from "~/v0/tile-engine";

const boardCellFeedbackVariants = [
	"primary",
	"secondary",
	"subtle",
	"danger",
] as const;

const boardSlots = boardCells.map((cell) => ({
	id: cell.key,
	dropId: `board-cell:${cell.key}`,
	renderKey: cell.key,
	data: cell,
})) satisfies readonly TileEngineType.Slot<BoardCellView>[];

export const BoardSurface = memo(
	({ feedback, feedbackFlags, onOpenItem, disabled = false }: BoardSurfaceType.Props) => {
		const boardDragBoundsRef = useRef<HTMLDivElement | null>(null);
		const board = useGameBoardView();
		const { drag, tiles } = useBoardTileEngineModel({
			feedback,
			onOpenItem,
		});
		const renderSlot = useCallback(
			({ slot }: TileEngineType.RenderSlotProps<BoardCellView>): ReactNode => {
				const cell = slot.data;
				const key = cellKey(cell.x, cell.y);
				const feedbackVariant = boardCellFeedbackVariants.find((variant) =>
					feedbackFlags.has(`board:feedback:${variant}:${key}`),
				);
				const statusVariant = board.byCellKey[key]?.activation?.deliveryBlocked
					? "danger"
					: undefined;
				return (
					<BoardCell
						cell={cell}
						feedbackVariant={feedbackVariant}
						statusVariant={statusVariant}
						invalid={feedbackFlags.has(`board:error:${key}`)}
					/>
				);
			},
			[
				board.byCellKey,
				feedbackFlags,
			],
		);

		return (
			<div ref={boardDragBoundsRef}>
				<TileEngine<BoardSurfaceType.TileData, BoardCellView, DragSource, DropTarget>
					id="board"
					columns={boardColumns}
					slots={boardSlots}
					tiles={tiles}
					gapPx={1}
					className="ak-layer-base-surface w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
					actorLayerClassName="pointer-events-none"
					layerRole="base"
					disabled={disabled}
					drag={drag}
					dragConstraintsRef={boardDragBoundsRef}
					renderSlot={renderSlot}
					renderTile={renderBoardTile}
				/>
			</div>
		);
	},
);
