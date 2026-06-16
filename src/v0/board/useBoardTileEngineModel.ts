import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useActivateBoardItemMutation } from "~/v0/board/action/useActivateBoardItemMutation";
import { useClaimCraftMutation } from "~/v0/board/action/useClaimCraftMutation";
import { useMergeBoardItemsMutation } from "~/v0/board/action/useMergeBoardItemsMutation";
import { useMoveBoardItemMutation } from "~/v0/board/action/useMoveBoardItemMutation";
import { useSwapBoardItemsMutation } from "~/v0/board/action/useSwapBoardItemsMutation";
import type { BoardCellView } from "~/v0/board/boardCells";
import { cellKey } from "~/v0/board/cellKey";
import { resolveBoardDropFeedback } from "~/v0/board/drop/resolveBoardDropFeedback";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { useBoardTransientTiles } from "~/v0/board/animation/BoardTransientTileStore";
import { useStashBoardItemMutation } from "~/v0/inventory/action/useStashBoardItemMutation";
import { inventoryViewQueryOptions } from "~/v0/inventory/query/inventoryViewQueryOptions";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useBoardTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		onOpenItem(boardItemId: string): void;
	}

	export interface Result {
		tiles: TileEngine.Tile<BoardSurface.TileData>[];
		drag: TileEngine.DragConfig<BoardSurface.TileData, BoardCellView, DragSource, DropTarget>;
	}
}

export const useBoardTileEngineModel = ({
	feedback,
	onOpenItem,
}: useBoardTileEngineModel.Props): useBoardTileEngineModel.Result => {
	const { data: board } = useSuspenseQuery(boardViewQueryOptions());
	const { data: inventory } = useSuspenseQuery(inventoryViewQueryOptions());
	const activateBoardItemMutation = useActivateBoardItemMutation();
	const claimCraftMutation = useClaimCraftMutation();
	const mergeBoardItemsMutation = useMergeBoardItemsMutation();
	const moveBoardItemMutation = useMoveBoardItemMutation();
	const stashBoardItemMutation = useStashBoardItemMutation();
	const swapBoardItemsMutation = useSwapBoardItemsMutation();
	const transientTiles = useBoardTransientTiles();

	const tiles = useMemo(
		() =>
			[
				...board.items.map((boardItem) => ({
					id: boardItem.id,
					slotId: cellKey(boardItem.x, boardItem.y),
					data: {
						kind: "board-item" as const,
						boardItemId: boardItem.id,
					},
					disabled: false,
					enter: boardItem.motion?.enter,
				})),
				...transientTiles.map((tile) => ({
					id: tile.id,
					slotId: tile.slotId,
					data: {
						kind: "static-item" as const,
						itemId: tile.itemId,
					},
					disabled: true,
					exit: tile.exit,
					style: {
						pointerEvents: "none" as const,
					},
				})),
			] satisfies TileEngine.Tile<BoardSurface.TileData>[],
		[
			board.items,
			transientTiles,
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
		TileEngine.DragConfig<BoardSurface.TileData, BoardCellView, DragSource, DropTarget>
	>(
		() => ({
			tile(tile) {
				if (tile.data.kind !== "board-item") return undefined;

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
				const targetBoardItemId =
					targetTile?.data.kind === "board-item"
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
			dropFeedback(context) {
				return resolveBoardDropFeedback({
					board,
					context,
				});
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

	return {
		drag,
		tiles,
	};
};
