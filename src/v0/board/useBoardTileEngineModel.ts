import { useCallback, useMemo } from "react";
import { readBoardCells, type BoardCellView } from "~/v0/board/boardCells";
import { cellKey } from "~/v0/board/cellKey";
import { resolveBoardDropFeedback } from "~/v0/board/drop/resolveBoardDropFeedback";
import { resolveBoardItemTapAction } from "~/v0/board/logic/resolveBoardItemTapAction";
import { readProducerMissingResourceHintTileIds } from "~/v0/producer/logic/readProducerMissingResourceHintTileIds";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import { useBoardTransientTiles } from "~/v0/board/animation/BoardTransientTileStore";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import { registerBoardTileBounceFeedback } from "~/v0/play/game-engine-visual/registerBoardTileBounceFeedback";
import {
	useGameBoardView,
	useGameRuntimeDropActions,
	useGameRuntimeSelector,
	useGameRuntimeStore,
} from "~/v0/play/runtime";
import { readBoardView, readInventoryView } from "~/v0/play/runtime/readers";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import { isCheatBoardItemId } from "~/v0/inventory/CheatBoardItem";
import { isInventoryBoardItemId } from "~/v0/inventory/InventoryBoardItem";
import { isNukeSaveBoardItemId } from "~/v0/inventory/NukeSaveBoardItem";

export namespace useBoardTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		onOpenCheatInventory(): void;
		onOpenInventory(): void;
		onOpenInventoryPlacementTarget(cell: { x: number; y: number }): void;
		onOpenItem(boardItemId: string): void;
		onOpenNukeSave(): void;
	}

	export interface Result {
		tiles: TileEngine.Tile<BoardSurface.TileData>[];
		drag: TileEngine.DragConfig<BoardSurface.TileData, BoardCellView, DragSource, DropTarget>;
		blockedCellKeys: readonly string[];
		columns: number;
		slots: TileEngine.Slot<BoardCellView>[];
	}
}

const transientTileStyle = {
	pointerEvents: "none" as const,
};

export const useBoardTileEngineModel = ({
	feedback,
	onOpenCheatInventory,
	onOpenInventory,
	onOpenInventoryPlacementTarget,
	onOpenItem,
	onOpenNukeSave,
}: useBoardTileEngineModel.Props): useBoardTileEngineModel.Result => {
	const board = useGameBoardView();
	const actions = useGameRuntimeDropActions();
	const runtimeStore = useGameRuntimeStore();
	const boardLayout = useGameRuntimeSelector((state) => state.runtime.config.game.board);
	const transientTiles = useBoardTransientTiles();

	const slots = useMemo(
		() =>
			readBoardCells(boardLayout).map((cell) => ({
				id: cell.key,
				dropId: `board-cell:${cell.key}`,
				renderKey: cell.key,
				data: cell,
			})) satisfies TileEngine.Slot<BoardCellView>[],
		[
			boardLayout,
		],
	);

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

	const blockedCellKeys = useMemo(
		() =>
			Object.entries(board.byCellKey)
				.filter(
					([, boardItem]) =>
						boardItem.activation?.deliveryBlocked || boardItem.craft?.deliveryBlocked,
				)
				.map(([key]) => key),
		[
			board.byCellKey,
		],
	);

	const activateBoardItem = useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const snapshot = runtimeStore.getSnapshot();
			const nowMs = Date.now();
			const liveBoard = readBoardView(snapshot);
			const liveBoardItem = liveBoard.byId[boardItemId];
			if (!liveBoardItem || liveBoardItem.itemId !== expectedItemId) return;

			const action = resolveBoardItemTapAction({
				boardItem: liveBoardItem,
				nowMs,
			});

			if (action.type === "claim-craft") {
				void runtimeStore
					.tick({
						nowMs,
					})
					.catch(feedback.showError);
				return;
			}

			if (action.type === "start-craft") {
				void runtimeStore
					.dispatch({
						action: {
							recipeId: action.recipeId,
							targetItemInstanceId: action.boardItemId,
							type: "craft.start",
						},
						nowMs,
					})
					.catch(feedback.showError);
				return;
			}

			if (action.type === "open-detail") {
				onOpenItem(action.boardItemId);
				return;
			}

			if (action.type === "open-inventory") {
				onOpenInventory();
				return;
			}

			if (action.type === "open-cheat-inventory") {
				onOpenCheatInventory();
				return;
			}

			if (action.type === "open-nuke-save") {
				onOpenNukeSave();
				return;
			}

			if (action.type !== "activate") return;

			const activation = liveBoardItem.activation;
			if (!activation) return;

			if (activation.kind === "stash") {
				void runtimeStore
					.dispatch({
						action: {
							inputRefs: [],
							stashItemInstanceId: liveBoardItem.id,
							type: "stash.open",
						},
						nowMs,
					})
					.catch(feedback.showError);
				return;
			}

			const hintTileIds = readProducerMissingResourceHintTileIds({
				board: liveBoard,
				config: snapshot.runtime.config,
				producerItem: liveBoardItem,
			});
			if (hintTileIds.length > 0) {
				registerBoardTileBounceFeedback({
					groupId: `producer-missing-resource-hint:${liveBoardItem.id}:${nowMs}`,
					tileIds: hintTileIds,
				});
			}

			void runtimeStore
				.dispatch({
					action: {
						inputRefs: [],
						producerItemInstanceId: liveBoardItem.id,
						productId: action.productId,
						type: "producer.product.start",
					},
					nowMs,
				})
				.catch(feedback.showError);
		},
		[
			feedback.showError,
			onOpenCheatInventory,
			onOpenInventory,
			onOpenItem,
			onOpenNukeSave,
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

				const opensInventory = isInventoryBoardItemId(boardItem.itemId);
				const opensCheatInventory = isCheatBoardItemId(boardItem.itemId);
				const opensNukeSave = isNukeSaveBoardItemId(boardItem.itemId);

				return {
					id: `board:${boardItem.id}`,
					data: {
						kind: "board",
						boardItemId: boardItem.id,
						itemId: boardItem.itemId,
						boardItem,
					},
					onSingleActivate: () => activateBoardItem(boardItem.id, boardItem.itemId),
					onLongActivate: opensInventory
						? onOpenInventory
						: opensCheatInventory
							? onOpenCheatInventory
							: opensNukeSave
								? onOpenNukeSave
								: () => onOpenItem(boardItem.id),
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
				const snapshot = runtimeStore.getSnapshot();

				return resolveBoardDropFeedback({
					board: readBoardView(snapshot),
					config: snapshot.runtime.config,
					context,
					inventory: readInventoryView(snapshot),
				});
			},
			onDrop(context) {
				const snapshot = runtimeStore.getSnapshot();

				return resolveDrop({
					context,
					board: readBoardView(snapshot),
					config: snapshot.runtime.config,
					inventory: readInventoryView(snapshot),
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
			board,
			feedback,
			runtimeStore,
			onOpenCheatInventory,
			onOpenInventory,
			onOpenInventoryPlacementTarget,
			onOpenItem,
			onOpenNukeSave,
		],
	);

	return {
		blockedCellKeys,
		columns: boardLayout.width,
		drag,
		slots,
		tiles,
	};
};
