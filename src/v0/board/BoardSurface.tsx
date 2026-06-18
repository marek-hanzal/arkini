import { memo, type ReactNode, useCallback } from "react";
import { BoardCell } from "~/v0/board/BoardCell";
import type { BoardSurface as BoardSurfaceType } from "~/v0/board/BoardSurface.types";
import { boardCells, type BoardCellView } from "~/v0/board/boardCells";
import { boardColumns } from "~/v0/board/boardColumns";
import { cellKey } from "~/v0/board/cellKey";
import { renderBoardTile } from "~/v0/board/renderBoardTile";
import { useBoardTileEngineModel } from "~/v0/board/useBoardTileEngineModel";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { TileEngine } from "~/v0/tile-engine";
import type { TileEngineNamespace as TileEngineType } from "~/v0/tile-engine";

const boardCellFeedbackVariants = [
	"primary",
	"secondary",
	"subtle",
] as const;

const boardSlots = boardCells.map((cell) => ({
	id: cell.key,
	dropId: `board-cell:${cell.key}`,
	renderKey: cell.key,
	data: cell,
})) satisfies readonly TileEngineType.Slot<BoardCellView>[];

export const BoardSurface = memo(
	({
		feedback,
		feedbackFlags,
		onOpenItem,
		disabled = false,
		dragConstraintsRef,
	}: BoardSurfaceType.Props) => {
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
				return (
					<BoardCell
						cell={cell}
						feedbackVariant={feedbackVariant}
						invalid={feedbackFlags.has(`board:error:${key}`)}
					/>
				);
			},
			[
				feedbackFlags,
			],
		);

		return (
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
				dragConstraintsRef={dragConstraintsRef}
				renderSlot={renderSlot}
				renderTile={renderBoardTile}
			/>
		);
	},
);
