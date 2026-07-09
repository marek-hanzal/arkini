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

const boardGridGapPx = 2;

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
						gapPx={boardGridGapPx}
						rootClassName="rounded-[1.35rem] border border-[rgba(232,178,240,0.92)] bg-[radial-gradient(circle_at_18%_12%,rgba(255,183,230,0.72),transparent_38%),radial-gradient(circle_at_84%_82%,rgba(196,181,253,0.64),transparent_40%),linear-gradient(145deg,rgba(255,241,252,0.96),rgba(245,226,255,0.92)_44%,rgba(255,228,239,0.88))] shadow-[0_18px_56px_rgba(168,85,247,0.24),0_24px_84px_rgba(236,72,153,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]"
						className="overflow-hidden rounded-[1rem] border border-[rgba(243,214,248,0.92)] bg-[radial-gradient(ellipse_at_18%_12%,rgba(236,72,153,0.18),transparent_35%),radial-gradient(ellipse_at_82%_18%,rgba(139,92,246,0.16),transparent_31%),radial-gradient(ellipse_at_78%_88%,rgba(244,114,182,0.16),transparent_42%),linear-gradient(145deg,rgba(217,70,239,0.22),rgba(168,85,247,0.20)_48%,rgba(236,72,153,0.22))] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.12),inset_0_0_42px_rgba(236,72,153,0.11),inset_0_-28px_62px_rgba(255,255,255,0.28)]"
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
