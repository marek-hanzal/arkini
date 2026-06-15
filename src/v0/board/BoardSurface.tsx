import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { boardCells, type BoardCellView } from "~/board/boardCells";
import { boardColumns } from "~/board/boardColumns";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { cellKey } from "~/board/util/cell";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { inventoryViewQueryOptions } from "~/v0/inventory/query/inventoryViewQueryOptions";
import { itemCatalogQueryOptions } from "~/v0/item/query/itemCatalogQueryOptions";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";
import { useActivateBoardItemMutation } from "~/v0/board/action/useActivateBoardItemMutation";
import { useClaimCraftMutation } from "~/v0/board/action/useClaimCraftMutation";
import { useMergeBoardItemsMutation } from "~/v0/board/action/useMergeBoardItemsMutation";
import { useMoveBoardItemMutation } from "~/v0/board/action/useMoveBoardItemMutation";
import { useStashBoardItemMutation } from "~/v0/inventory/action/useStashBoardItemMutation";
import { useSwapBoardItemsMutation } from "~/v0/board/action/useSwapBoardItemsMutation";
import type { DragSource, DropTarget } from "~/v0/play/DragTypes";
import { BoardCell } from "~/v0/board/BoardCell";
import type { BoardSurface as BoardSurfaceType } from "~/v0/board/BoardSurface.types";
import { renderBoardTile } from "~/v0/board/renderBoardTile";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { resolveDrop } from "~/v0/play/resolveDrop";
import { TileEngine } from "~/v0/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";

const boardSlots = boardCells.map((cell) => ({
	id: cell.key,
	data: cell,
})) satisfies readonly TileEngineType.Slot<BoardCellView>[];

export const BoardSurface = memo(
	({ feedback, feedbackFlags, onOpenItem }: BoardSurfaceType.Props) => {
		const { data: board } = useSuspenseQuery(boardViewQueryOptions());
		const { data: inventory } = useSuspenseQuery(inventoryViewQueryOptions());
		const { data: items } = useSuspenseQuery(itemCatalogQueryOptions());
		const activateBoardItemMutation = useActivateBoardItemMutation();
		const claimCraftMutation = useClaimCraftMutation();
		const mergeBoardItemsMutation = useMergeBoardItemsMutation();
		const moveBoardItemMutation = useMoveBoardItemMutation();
		const stashBoardItemMutation = useStashBoardItemMutation();
		const swapBoardItemsMutation = useSwapBoardItemsMutation();
		const nowMs = useProducerClock(board.items);
		const tiles = useMemo(
			() =>
				board.items.flatMap((boardItem) => {
					const item = items[boardItem.itemId];
					if (!item) return [];

					return [
						{
							id: boardItem.id,
							slotId: cellKey(boardItem.x, boardItem.y),
							data: {
								boardItem,
								item,
								activationNowMs: boardItem.activation ? nowMs : undefined,
							},
						},
					] satisfies TileEngineType.Tile<BoardSurfaceType.TileData>[];
				}),
			[
				board.items,
				items,
				nowMs,
			],
		);
		const actions = useMemo<DropActions>(
			() => ({
				mergeBoardItems: mergeBoardItemsMutation.mutateAsync,
				moveBoardItem: moveBoardItemMutation.mutateAsync,
				placeInventoryItem: async () => undefined,
				stashBoardItem: stashBoardItemMutation.mutateAsync,
				swapBoardItems: swapBoardItemsMutation.mutateAsync,
				swapInventorySlots: async () => undefined,
			}),
			[
				mergeBoardItemsMutation.mutateAsync,
				moveBoardItemMutation.mutateAsync,
				stashBoardItemMutation.mutateAsync,
				swapBoardItemsMutation.mutateAsync,
			],
		);
		const activateBoardItem = useCallback(
			(boardItem: BoardViewItem) => {
				if (boardItem.craft?.complete) {
					claimCraftMutation.mutate({
						boardItemId: boardItem.id,
					});
					return;
				}

				if (!boardItem.activation) return;
				activateBoardItemMutation.mutate({
					boardItemId: boardItem.id,
					activation: boardItem.activation.kind === "stash" ? "exhaust" : "single",
				});
			},
			[
				activateBoardItemMutation.mutate,
				claimCraftMutation.mutate,
			],
		);
		const drag = useMemo<
			TileEngineType.DragConfig<
				BoardSurfaceType.TileData,
				BoardCellView,
				DragSource,
				DropTarget
			>
		>(
			() => ({
				tile(tile) {
					const boardItem = tile.data.boardItem;
					return {
						id: `board:${boardItem.id}`,
						data: {
							kind: "board",
							boardItemId: boardItem.id,
							itemId: boardItem.itemId,
							boardItem,
						},
						onSingleActivate: () => activateBoardItem(boardItem),
						onLongActivate: () => onOpenItem(boardItem.id),
					};
				},
				slot(slot, targetTile) {
					const cell = slot.data;
					return {
						id: `board-cell:${cell.key}`,
						data: {
							kind: "cell",
							x: cell.x,
							y: cell.y,
							boardItemId: targetTile?.data.boardItem.id,
						},
					};
				},
				onDrop(context) {
					return resolveDrop({
						context,
						board,
						inventory,
						feedback,
						actions,
					});
				},
				onDragCancel() {
					// The engine owns visual rollback. App state remains untouched until commit.
				},
			}),
			[
				actions,
				activateBoardItem,
				board,
				feedback,
				inventory,
				onOpenItem,
			],
		);
		const renderSlot = useCallback(
			({ slot, isOver }: TileEngineType.RenderSlotProps<BoardCellView>): ReactNode => {
				const cell = slot.data;
				const key = cell.key;
				return (
					<BoardCell
						cell={cell}
						boardItem={board.byCellKey[key]}
						invalid={feedbackFlags.has(`board:error:${key}`)}
						merged={feedbackFlags.has(`board:merge:${key}`)}
						imprinted={feedbackFlags.has(`board:imprint:${key}`)}
						isOver={isOver}
						nowMs={nowMs}
					/>
				);
			},
			[
				board.byCellKey,
				feedbackFlags,
				nowMs,
			],
		);

		return (
			<TileEngine<BoardSurfaceType.TileData, BoardCellView, DragSource, DropTarget>
				id="board"
				columns={boardColumns}
				slots={boardSlots}
				tiles={tiles}
				gapPx={1}
				className="w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
				itemLayerClassName="pointer-events-none"
				drag={drag}
				renderSlot={renderSlot}
				renderTile={renderBoardTile}
			/>
		);
	},
);
