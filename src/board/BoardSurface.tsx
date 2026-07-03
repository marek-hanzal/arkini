import { memo, type ReactNode, useCallback, useMemo } from "react";
import { BoardCell } from "~/board/BoardCell";
import type { BoardSurface as BoardSurfaceType } from "~/board/BoardSurface.types";
import type { BoardCellView } from "~/board/boardCells";
import { cellKey } from "~/board/cellKey";
import { renderBoardTile } from "~/board/renderBoardTile";
import { useBoardTileEngineModel } from "~/board/useBoardTileEngineModel";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { TileEngine } from "~/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/tile-engine/TileEngine.types";

const boardCellFeedbackVariants = [
	"primary",
	"secondary",
	"subtle",
	"danger",
] as const;

export const BoardSurface = memo(
	({ feedback, feedbackFlags, onOpenSheet, disabled = false }: BoardSurfaceType.Props) => {
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
				className="flex h-full w-full items-center justify-center overflow-hidden px-3 py-3 sm:px-4 sm:py-4"
				style={{
					zIndex: "var(--ak-layer-base-surface)",
				}}
			>
				<div
					data-ui="board viewport"
					className="flex h-full w-full min-w-0 items-center justify-center"
					style={{
						containerType: "size",
					}}
				>
					<TileEngine<BoardSurfaceType.TileData, BoardCellView, DragSource, DropTarget>
						id="board"
						columns={columns}
						slots={slots}
						tiles={tiles}
						gapPx={1}
						rootClassName="rounded-[1.35rem] border border-fuchsia-300/20 bg-[radial-gradient(circle_at_18%_12%,rgba(236,72,153,0.20),transparent_38%),radial-gradient(circle_at_84%_82%,rgba(124,58,237,0.18),transparent_40%),linear-gradient(145deg,rgba(236,72,153,0.12),rgba(124,58,237,0.08)_44%,rgba(12,6,17,0.18))] shadow-[0_0_0_1px_rgba(255,255,255,0.045),0_0_48px_rgba(168,85,247,0.34),0_24px_84px_rgba(236,72,153,0.20),inset_0_1px_0_rgba(255,255,255,0.08)]"
						className="overflow-hidden rounded-[1rem] border border-black/50 bg-[radial-gradient(ellipse_at_12%_10%,rgba(236,72,153,0.26),transparent_34%),radial-gradient(ellipse_at_88%_18%,rgba(251,113,133,0.14),transparent_28%),radial-gradient(ellipse_at_74%_88%,rgba(124,58,237,0.28),transparent_42%),radial-gradient(circle_at_36%_66%,rgba(192,132,252,0.11),transparent_30%),conic-gradient(from_225deg_at_50%_48%,rgba(236,72,153,0.08),rgba(124,58,237,0.12),rgba(20,9,30,0.04),rgba(236,72,153,0.08)),linear-gradient(145deg,#2a1537,#160a20_54%,#0d0613)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045),inset_0_0_42px_rgba(236,72,153,0.11),inset_0_-28px_62px_rgba(0,0,0,0.20)]"
						container="responsive"
						actorLayerClassName="pointer-events-none"
						layerRole="base"
						disabled={disabled}
						drag={drag}
						renderSlot={renderSlot}
						renderTile={renderBoardTile}
					/>
				</div>
			</div>
		);
	},
);
