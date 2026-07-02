import { memo, type ReactNode, useCallback, useMemo, useRef } from "react";
import { BoardCell } from "~/board/BoardCell";
import type { BoardSurface as BoardSurfaceType } from "~/board/BoardSurface.types";
import type { BoardCellView } from "~/board/boardCells";
import { cellKey } from "~/board/cellKey";
import { renderBoardTile } from "~/board/renderBoardTile";
import { useBoardTileEngineModel } from "~/board/useBoardTileEngineModel";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { TileEngine } from "~/tile-engine";
import type { TileEngineNamespace as TileEngineType } from "~/tile-engine";

const boardCellFeedbackVariants = [
	"primary",
	"secondary",
	"subtle",
	"danger",
] as const;

export const BoardSurface = memo(
	({ feedback, feedbackFlags, onOpenSheet, disabled = false }: BoardSurfaceType.Props) => {
		const boardDragBoundsRef = useRef<HTMLDivElement | null>(null);
		const { blockedCellKeys, columns, drag, slots, tiles } = useBoardTileEngineModel({
			feedback,
			onOpenSheet,
		});
		const blockedCells = useMemo(
			() => new Set(blockedCellKeys),
			[
				blockedCellKeys,
			],
		);

		const renderSlot = useCallback(
			({ slot }: TileEngineType.RenderSlotProps<BoardCellView>): ReactNode => {
				const cell = slot.data;
				const key = cellKey(cell.x, cell.y);
				const feedbackVariant = boardCellFeedbackVariants.find((variant) =>
					feedbackFlags.has(`board:feedback:${variant}:${key}`),
				);
				const statusVariant = blockedCells.has(key) ? "danger" : undefined;
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
				blockedCells,
				feedbackFlags,
			],
		);

		return (
			<div
				data-ui="board surface"
				className="flex h-full w-full items-center justify-center overflow-hidden"
				style={{
					containerType: "size",
					zIndex: "var(--ak-layer-base-surface)",
				}}
			>
				<TileEngine<BoardSurfaceType.TileData, BoardCellView, DragSource, DropTarget>
					id="board"
					rootRef={boardDragBoundsRef}
					columns={columns}
					slots={slots}
					tiles={tiles}
					gapPx={1}
					className="bg-ak-board"
					container="responsive"
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
