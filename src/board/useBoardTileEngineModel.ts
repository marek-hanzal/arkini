import { useCallback, useMemo } from "react";
import { useGameAudio } from "~/audio/GameAudioProvider";
import { readBoardCells, type BoardCellView } from "~/board/boardCells";
import { cellKey } from "~/board/cellKey";
import { resolveBoardDropFeedback } from "~/board/drop/resolveBoardDropFeedback";
import { resolveBoardItemTapAction } from "~/board/logic/resolveBoardItemTapAction";
import { readProducerMissingResourceHintTileIds } from "~/producer/logic/readProducerMissingResourceHintTileIds";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { readBoardUtilityItemSheet } from "~/board/BoardUtilityItem";
import { useBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { resolveDrop } from "~/play/drop/resolveDrop";
import type { Feedback } from "~/play/feedback/Feedback";
import { registerBoardTileBounceFeedback } from "~/play/game-engine-visual/registerBoardTileBounceFeedback";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useBoardTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		onOpenSheet(sheet: ActiveSheetState): void;
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

const readBoardItemSheet = ({
	boardItemId,
	itemId,
}: {
	boardItemId: string;
	itemId: string;
}): ActiveSheetState =>
	readBoardUtilityItemSheet(itemId) ?? {
		boardItemId,
		type: "item",
	};

export const useBoardTileEngineModel = ({
	feedback,
	onOpenSheet,
}: useBoardTileEngineModel.Props): useBoardTileEngineModel.Result => {
	const audio = useGameAudio();
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
					renderKey: `static-item:${tile.id}:${tile.slotId}:${tile.itemId}:${tile.assetProgress ?? "none"}`,
					data: {
						assetProgress: tile.assetProgress,
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

	const openBoardItemSheet = useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const snapshot = runtimeStore.getSnapshot();
			const liveBoardItem = readBoardView(snapshot, Date.now()).byId[boardItemId];
			if (!liveBoardItem || liveBoardItem.itemId !== expectedItemId) return;

			onOpenSheet(
				readBoardItemSheet({
					boardItemId: liveBoardItem.id,
					itemId: liveBoardItem.itemId,
				}),
			);
		},
		[
			onOpenSheet,
			runtimeStore,
		],
	);

	const activateBoardItem = useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const snapshot = runtimeStore.getSnapshot();
			const nowMs = Date.now();
			const liveBoard = readBoardView(snapshot, nowMs);
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

			if (action.type === "open-sheet") {
				onOpenSheet(action.sheet);
				return;
			}

			if (action.type === "set-cheat-speed-mode") {
				void runtimeStore
					.dispatch({
						action: {
							mode: action.mode,
							type: "cheat.speed_mode.set",
						},
						nowMs,
					})
					.catch(feedback.showError);
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
						itemInstanceId: liveBoardItem.id,
						lineId: action.lineId,
						type: "line.start",
					},
					nowMs,
				})
				.catch(feedback.showError);
		},
		[
			feedback.showError,
			onOpenSheet,
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
					onSingleActivate: () => activateBoardItem(boardItem.id, boardItem.itemId),
					onLongActivate: () => {
						audio.play("audio.tile.long_press");
						openBoardItemSheet(boardItem.id, boardItem.itemId);
					},
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
						: () => {
								audio.play("audio.tile.long_press");
								onOpenSheet({
									placementTarget: {
										x: cell.x,
										y: cell.y,
									},
									type: "inventory",
								});
							},
				};
			},
			dropFeedback(context) {
				const snapshot = runtimeStore.getSnapshot();
				const nowMs = Date.now();

				return resolveBoardDropFeedback({
					board: readBoardView(snapshot, nowMs),
					config: snapshot.runtime.config,
					context,
					inventory: readInventoryView(snapshot),
				});
			},
			onDragStart() {
				audio.play("audio.tile.drag.start");
			},
			onDrop(context) {
				const snapshot = runtimeStore.getSnapshot();
				const nowMs = Date.now();

				return resolveDrop({
					context,
					board: readBoardView(snapshot, nowMs),
					config: snapshot.runtime.config,
					inventory: readInventoryView(snapshot),
					feedback,
					actions,
				});
			},
			onDropSettled({ kind }) {
				if (kind === "accept") {
					audio.play("audio.tile.drop.accept");
					return;
				}
				if (kind === "reject") audio.play("audio.tile.drop.reject");
			},
			onDragCancel() {
				// The runtime engine owns visual rollback. App state remains untouched until commit.
			},
		}),
		[
			actions,
			activateBoardItem,
			audio,
			board,
			feedback,
			openBoardItemSheet,
			runtimeStore,
			onOpenSheet,
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
