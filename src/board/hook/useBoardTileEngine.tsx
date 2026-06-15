import { useCallback, useMemo, type ReactNode } from "react";
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
import { usePlayDragState } from "~/play/hook/usePlayDragState";
import { usePlayFeedbackState } from "~/play/hook/usePlayFeedbackState";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { usePlayActivationActions } from "~/play/hook/usePlayActivationActions";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";
import { visualBoardItemKey } from "~/play/hook/useVisualItemMotions";
import { usePlayVisualMotionsState } from "~/play/hook/usePlayVisualMotionsState";
import type { DragData, DropData } from "~/play/types";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace useBoardTileEngine {
	export interface Props {}

	export interface BoardTileData {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
	}

	export interface Result {
		slots: readonly TileEngine.Slot<BoardCellView>[];
		tiles: readonly TileEngine.Tile<BoardTileData>[];
		activeDropTargetNodeId: string | null;
		dragConfig: TileEngine.DragConfig<BoardTileData, BoardCellView, DragData, DropData>;
		renderSlot(props: TileEngine.RenderSlotProps<BoardCellView>): ReactNode;
		renderTile(props: TileEngine.RenderTileProps<BoardTileData>): ReactNode;
	}
}

export const useBoardTileEngine = (
	_props?: useBoardTileEngine.Props,
): useBoardTileEngine.Result => {
	const board = useBoardView();
	const items = usePlayItems();
	const sheets = usePlaySheetsState();
	const drag = usePlayDragState();
	const feedback = usePlayFeedbackState();
	const visualMotions = usePlayVisualMotionsState();
	const activationActions = usePlayActivationActions();
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
	const activateBoardTile = useCallback(
		(item: BoardViewItem) => {
			if (!item.activation) return;

			void activationActions.activateFrom(
				item,
				item.activation.kind === "stash" ? "exhaust" : "single",
			);
		},
		[
			activationActions.activateFrom,
		],
	);
	const openBoardTileDetail = useCallback(
		(item: BoardViewItem) => {
			sheets.openItem(item.id);
		},
		[
			sheets.openItem,
		],
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
					onSingleActivate: () => activateBoardTile(boardItem),
					onLongActivate: () => openBoardTileDetail(boardItem),
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
			activateBoardTile,
			drag.cancel,
			drag.drop,
			drag.isSourceHidden,
			drag.setActiveDropTargetNodeId,
			drag.start,
			openBoardTileDetail,
		],
	);
	const renderSlot = useCallback(
		({ slot, isOver }: TileEngine.RenderSlotProps<BoardCellView>) => {
			const cell = slot.data;
			const boardItem = board.byCellKey[cell.key];
			const canMerge = canBoardCellAcceptDrag({
				activeDrag: drag.activeDrag ?? undefined,
				boardItem,
			});

			return (
				<BoardCell
					x={cell.x}
					y={cell.y}
					boardItem={boardItem}
					canMerge={canMerge}
					showDelayedMergeHint={showDelayedMergeHints}
					invalid={feedback.invalidBoardCellKey === cell.key}
					merged={feedback.mergedBoardCellKey === cell.key}
					imprinted={feedback.imprintedBoardCellKey === cell.key}
					isOver={isOver}
				/>
			);
		},
		[
			board.byCellKey,
			drag.activeDrag,
			feedback.imprintedBoardCellKey,
			feedback.invalidBoardCellKey,
			feedback.mergedBoardCellKey,
			showDelayedMergeHints,
		],
	);
	const renderTile = useCallback(
		({ tile }: TileEngine.RenderTileProps<useBoardTileEngine.BoardTileData>) => (
			<BoardTile
				boardItem={tile.data.boardItem}
				item={tile.data.item}
				activationNowMs={tile.data.activationNowMs}
			/>
		),
		[
			activateBoardTile,
			openBoardTileDetail,
		],
	);

	return {
		slots,
		tiles,
		activeDropTargetNodeId: drag.activeDropTargetNodeId ?? null,
		dragConfig,
		renderSlot,
		renderTile,
	};
};
