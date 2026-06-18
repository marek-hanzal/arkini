import { useCallback, useMemo } from "react";
import type { BoardCellView } from "~/v0/board/boardCells";
import { cellKey } from "~/v0/board/cellKey";
import { resolveBoardDropFeedback } from "~/v0/board/drop/resolveBoardDropFeedback";
import { resolveBoardItemTapAction } from "~/v0/board/logic/resolveBoardItemTapAction";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { useBoardTransientTiles } from "~/v0/board/animation/BoardTransientTileStore";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import {
	useGameBoardView,
	useGameInventoryView,
	useGameRuntimeDropActions,
	useGameRuntimeStore,
} from "~/v0/play/runtime";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace useBoardTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		onOpenInventoryPlacementTarget(cell: { x: number; y: number }): void;
		onOpenItem(boardItemId: string): void;
	}

	export interface Result {
		tiles: TileEngine.Tile<BoardSurface.TileData>[];
		drag: TileEngine.DragConfig<BoardSurface.TileData, BoardCellView, DragSource, DropTarget>;
	}
}

const transientTileStyle = {
	pointerEvents: "none" as const,
};

export const useBoardTileEngineModel = ({
	feedback,
	onOpenInventoryPlacementTarget,
	onOpenItem,
}: useBoardTileEngineModel.Props): useBoardTileEngineModel.Result => {
	const board = useGameBoardView();
	const inventory = useGameInventoryView();
	const actions = useGameRuntimeDropActions();
	const runtimeStore = useGameRuntimeStore();
	const config = runtimeStore.getSnapshot().runtime.config;
	const transientTiles = useBoardTransientTiles();

	const tiles = useMemo(
		() =>
			[
				...board.items.map((boardItem) => {
					const slotId = cellKey(boardItem.x, boardItem.y);

					return {
						id: boardItem.id,
						slotId,
						renderKey: `board-item:${boardItem.id}:${slotId}`,
						data: {
							kind: "board-item" as const,
							boardItemId: boardItem.id,
						},
						disabled: false,
					};
				}),
				...transientTiles.map((tile) => ({
					id: tile.id,
					slotId: tile.slotId,
					renderKey: `static-item:${tile.id}:${tile.slotId}:${tile.itemId}`,
					data: {
						kind: "static-item" as const,
						itemId: tile.itemId,
					},
					disabled: true,
					style: transientTileStyle,
				})),
			] satisfies TileEngine.Tile<BoardSurface.TileData>[],
		[
			board.items,
			transientTiles,
		],
	);

	const activateBoardItem = useCallback(
		(boardItem: BoardViewItem) => {
			const action = resolveBoardItemTapAction({
				boardItem,
				nowMs: Date.now(),
			});

			if (action.type === "claim-craft") {
				void runtimeStore
					.tick({
						nowMs: Date.now(),
					})
					.catch(feedback.showError);
				return;
			}

			if (action.type !== "activate") return;

			const activation = boardItem.activation;
			if (!activation) return;

			if (activation.kind === "stash") {
				void runtimeStore
					.dispatch({
						action: {
							inputRefs: [],
							stashItemInstanceId: boardItem.id,
							type: "stash.open",
						},
					})
					.catch(feedback.showError);
				return;
			}

			const productId = activation.productLines?.find((line) => line.enabled)?.productId;

			if (!productId) {
				feedback.showError("No enabled product line.");
				return;
			}

			void runtimeStore
				.dispatch({
					action: {
						inputRefs: [],
						producerItemInstanceId: boardItem.id,
						productId,
						type: "producer.product.start",
					},
				})
				.catch(feedback.showError);
		},
		[
			feedback.showError,
			runtimeStore,
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
					data: {
						kind: "cell",
						x: cell.x,
						y: cell.y,
						boardItemId: targetBoardItemId,
					},
					onLongActivate: targetBoardItemId
						? undefined
						: () =>
								onOpenInventoryPlacementTarget({
									x: cell.x,
									y: cell.y,
								}),
				};
			},
			dropFeedback(context) {
				return resolveBoardDropFeedback({
					board,
					config,
					context,
				});
			},
			onDrop(context) {
				return resolveDrop({
					context,
					board,
					config,
					inventory,
					feedback,
					actions,
				});
			},
			onDragCancel() {
				// The runtime engine owns visual rollback. App state remains untouched until commit.
			},
		}),
		[
			actions,
			activateBoardItem,
			config,
			board,
			feedback,
			inventory,
			onOpenInventoryPlacementTarget,
			onOpenItem,
		],
	);

	return {
		drag,
		tiles,
	};
};
