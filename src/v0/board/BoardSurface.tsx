import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { boardCells, type BoardCellView } from "~/v0/board/boardCells";
import { boardColumns } from "~/v0/board/boardColumns";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { cellKey } from "~/v0/board/cellKey";
import { inventoryViewQueryOptions } from "~/v0/inventory/query/inventoryViewQueryOptions";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";
import { useActivateBoardItemMutation } from "~/v0/board/action/useActivateBoardItemMutation";
import { useClaimCraftMutation } from "~/v0/board/action/useClaimCraftMutation";
import { useMergeBoardItemsMutation } from "~/v0/board/action/useMergeBoardItemsMutation";
import { useMoveBoardItemMutation } from "~/v0/board/action/useMoveBoardItemMutation";
import { useStashBoardItemMutation } from "~/v0/inventory/action/useStashBoardItemMutation";
import { useSwapBoardItemsMutation } from "~/v0/board/action/useSwapBoardItemsMutation";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { BoardCell } from "~/v0/board/BoardCell";
import type { BoardSurface as BoardSurfaceType } from "~/v0/board/BoardSurface.types";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
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
		const activateBoardItemMutation = useActivateBoardItemMutation();
		const claimCraftMutation = useClaimCraftMutation();
		const mergeBoardItemsMutation = useMergeBoardItemsMutation();
		const moveBoardItemMutation = useMoveBoardItemMutation();
		const stashBoardItemMutation = useStashBoardItemMutation();
		const swapBoardItemsMutation = useSwapBoardItemsMutation();
		const tiles = useMemo(
			() =>
				board.items.map((boardItem) => ({
					id: boardItem.id,
					slotId: cellKey(boardItem.x, boardItem.y),
					data: {
						boardItemId: boardItem.id,
					},
					enter: boardItem.motion?.enter,
				})) satisfies TileEngineType.Tile<BoardSurfaceType.TileData>[],
			[
				board.items,
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
				const liveCraft = readLiveCraftView({
					craft: boardItem.craft,
					nowMs: Date.now(),
				});
				if (liveCraft?.complete) {
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
					const boardItem = board.byId[tile.data.boardItemId];
					if (!boardItem) return undefined;

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
					const targetBoardItemId = targetTile
						? board.byId[targetTile.data.boardItemId]?.id
						: undefined;
					return {
						id: `board-cell:${cell.key}`,
						data: {
							kind: "cell",
							x: cell.x,
							y: cell.y,
							boardItemId: targetBoardItemId,
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
						invalid={feedbackFlags.has(`board:error:${key}`)}
						merged={feedbackFlags.has(`board:merge:${key}`)}
						imprinted={feedbackFlags.has(`board:imprint:${key}`)}
						isOver={isOver}
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
				className="w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
				itemLayerClassName="pointer-events-none"
				drag={drag}
				renderSlot={renderSlot}
				renderTile={renderBoardTile}
			/>
		);
	},
);
