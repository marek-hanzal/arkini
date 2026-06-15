import { useCallback, useMemo } from "react";
import { boardCellNodeId } from "~/board/boardCellNodeId";
import { boardCells, type BoardCellView } from "~/board/boardCells";
import { boardSourceId } from "~/board/boardSourceId";
import { useBoardView } from "~/board/hook/useBoardView";
import { useDelayedMergeHints } from "~/board/hook/useDelayedMergeHints";
import { canBoardCellAcceptDrag } from "~/board/logic/canBoardCellAcceptDrag";
import { BoardCell } from "~/board/ui/BoardCell";
import { BoardTile } from "~/board/ui/BoardTile";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { visualBoardItemKey, type useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { DragData, DropData, RectLike } from "~/play/types";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace useBoardTileEngine {
	export interface DragState {
		activeDrag?: DragData;
		activeDropTargetNodeId?: string | null;
		isSourceHidden(sourceId: string): boolean;
		setActiveDropTargetNodeId(nodeId: string | null): void;
		start(props: { source: DragData; previewRect: Pick<RectLike, "width" | "height"> }): void;
		drop(props: { source: DragData; target: DropData | null; dragRect: RectLike | null }): void;
		cancel(): void;
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

	export interface BoardTileData {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
	}
}

export const useBoardTileEngine = ({
	drag,
	feedback,
	actions,
	visualMotions,
}: useBoardTileEngine.Props) => {
	const board = useBoardView();
	const items = usePlayItems();
	const showDelayedMergeHints = useDelayedMergeHints({
		activeDrag: drag.activeDrag ?? undefined,
	});
	const nowMs = useProducerClock(board.items);
	const slots = useMemo(
		() =>
			boardCells.map((cell) => ({
				id: cell.key,
				data: cell,
			})),
		[],
	);
	const tiles = useMemo(
		() =>
			board.items.flatMap((boardItem) => {
				const item = items[boardItem.itemId];
				if (!item) return [];

				const motionKey = visualBoardItemKey(boardItem.id);
				const visualMotion = visualMotions.motions[motionKey];

				return [
					{
						id: boardItem.id,
						slotId: `${boardItem.x}:${boardItem.y}`,
						hidden: drag.isSourceHidden(boardSourceId(boardItem.id)),
						motion: visualMotion,
						onMotionSettle: visualMotion
							? () => visualMotions.settle(motionKey, visualMotion.nonce)
							: undefined,
						data: {
							boardItem,
							item,
							activationNowMs: boardItem.activation ? nowMs : undefined,
						} satisfies useBoardTileEngine.BoardTileData,
					},
				];
			}),
		[
			board.items,
			drag.isSourceHidden,
			items,
			nowMs,
			visualMotions,
		],
	);
	const dragConfig = useMemo<
		TileEngine.DragConfig<useBoardTileEngine.BoardTileData, BoardCellView, DragData, DropData>
	>(
		() => ({
			onDragStart: (source, rect) =>
				drag.start({
					source,
					previewRect: {
						width: rect.width,
						height: rect.height,
					},
				}),
			onDragOver: (_source, _target, targetNodeId) => {
				drag.setActiveDropTargetNodeId(targetNodeId);
			},
			onDrop: (source, target, dragRect) =>
				drag.drop({
					source,
					target,
					dragRect,
				}),
			onDragCancel: drag.cancel,
			tile: (tile) => {
				const boardItem = tile.data.boardItem;
				const sourceId = boardSourceId(boardItem.id);
				const nodeId = `${sourceId}:drag`;

				return {
					id: sourceId,
					nodeId,
					data: {
						sourceId,
						sourceNodeId: nodeId,
						itemId: boardItem.itemId,
						source: {
							kind: "board",
							boardItemId: boardItem.id,
						},
						overlay: {
							activation: boardItem.activation,
						},
						hideWhenActive: true,
					} satisfies DragData,
					hidden: drag.isSourceHidden(sourceId),
					hideWhenActive: true,
					onSingleActivate: () => actions.tileSingleActivate(boardItem),
					onLongActivate: () => actions.tileLongActivate(boardItem),
				};
			},
			slot: (slot, targetTile) => {
				const cell = slot.data;
				const id = boardCellNodeId(cell.x, cell.y);

				return {
					id,
					nodeId: id,
					data: {
						targetId: id,
						targetNodeId: id,
						target: {
							kind: "cell",
							x: cell.x,
							y: cell.y,
							boardItemId: targetTile?.data.boardItem.id,
						},
					} satisfies DropData,
				};
			},
		}),
		[
			actions,
			drag.cancel,
			drag.drop,
			drag.isSourceHidden,
			drag.setActiveDropTargetNodeId,
			drag.start,
		],
	);
	const renderSlot = useCallback(
		({ slot, isOver }: TileEngine.RenderSlotProps<BoardCellView>) => {
			const cell = slot.data;
			const boardItem = board.byCellKey[cell.key];
			const canMerge = canBoardCellAcceptDrag({
				activeDrag: drag.activeDrag,
				boardItem,
			});

			return (
				<BoardCell
					x={cell.x}
					y={cell.y}
					boardItem={boardItem}
					canMerge={canMerge}
					showDelayedMergeHint={showDelayedMergeHints}
					invalid={feedback.invalidCellKey === cell.key}
					merged={feedback.mergedCellKey === cell.key}
					imprinted={feedback.imprintedCellKey === cell.key}
					isOver={isOver}
				/>
			);
		},
		[
			board.byCellKey,
			drag.activeDrag,
			feedback.imprintedCellKey,
			feedback.invalidCellKey,
			feedback.mergedCellKey,
			showDelayedMergeHints,
		],
	);
	const renderTile = useCallback(
		({ tile }: TileEngine.RenderTileProps<useBoardTileEngine.BoardTileData>) => (
			<BoardTile
				boardItem={tile.data.boardItem}
				item={tile.data.item}
				activationNowMs={tile.data.activationNowMs}
				onSingleActivate={actions.tileSingleActivate}
				onLongActivate={actions.tileLongActivate}
			/>
		),
		[
			actions.tileLongActivate,
			actions.tileSingleActivate,
		],
	);

	return {
		slots,
		tiles,
		dragConfig,
		renderSlot,
		renderTile,
	};
};
