import { useCallback, useMemo } from "react";
import { useGameAudio } from "~/audio/GameAudioProvider";
import { readBoardCells, type BoardCellView } from "~/board/boardCells";
import { cellKey } from "~/board/cellKey";
import { resolveBoardDropFeedback } from "~/board/drop/resolveBoardDropFeedback";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { readBoardUtilityItemSheet } from "~/board/BoardUtilityItem";
import { isBoardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { useBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import { useBoardItemActivation } from "~/board/useBoardItemActivation";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { createRuntimeDropLifecycle } from "~/play/drag/createRuntimeDropLifecycle";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
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

type BoardTileEngineDragConfig = TileEngine.DragConfig<
	BoardSurface.TileData,
	BoardCellView,
	DragSource,
	DropTarget
>;

type BoardTileEngineTile = Parameters<BoardTileEngineDragConfig["tile"]>[0];
type BoardTileEngineSlot = Parameters<BoardTileEngineDragConfig["slot"]>[0];
type BoardTileEngineTargetTile = Parameters<BoardTileEngineDragConfig["slot"]>[1];

const transientTileStyle = {
	pointerEvents: "none" as const,
};

const readBoardItemSheet = ({
	boardItemId,
	itemId,
}: {
	boardItemId: string;
	itemId: string;
}): ActiveSheetState => {
	if (isBoardMemoryItemId(itemId)) {
		return {
			boardItemId,
			type: "board-memory",
		};
	}

	return (
		readBoardUtilityItemSheet(itemId) ?? {
			boardItemId,
			type: "item",
		}
	);
};

const useBoardSurfaceSlots = ({ boardLayout }: { boardLayout: readBoardCells.Props }) =>
	useMemo(
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

const useBoardSurfaceTiles = ({
	board,
	transientTiles,
}: {
	board: ReturnType<typeof useGameBoardView>;
	transientTiles: ReturnType<typeof useBoardTransientTiles>;
}) =>
	useMemo(
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

const useBlockedBoardCellKeys = ({ board }: { board: ReturnType<typeof useGameBoardView> }) =>
	useMemo(
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

const readBoardTileDragActor = ({
	activateBoardItem,
	audio,
	board,
	openBoardItemSheet,
	tile,
}: {
	activateBoardItem: useBoardItemActivation.Result;
	audio: ReturnType<typeof useGameAudio>;
	board: ReturnType<typeof useGameBoardView>;
	openBoardItemSheet(boardItemId: string, expectedItemId: string): void;
	tile: BoardTileEngineTile;
}) => {
	if (tile.data.kind !== "board-item") return undefined;

	const boardItem = board.byId[tile.data.boardItemId];
	if (!boardItem) return undefined;

	return {
		id: `board:${boardItem.id}`,
		data: {
			kind: "board" as const,
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
};

const readBoardCellDropTarget = ({
	audio,
	board,
	onOpenSheet,
	slot,
	targetTile,
}: {
	audio: ReturnType<typeof useGameAudio>;
	board: ReturnType<typeof useGameBoardView>;
	onOpenSheet(sheet: ActiveSheetState): void;
	slot: BoardTileEngineSlot;
	targetTile: BoardTileEngineTargetTile;
}) => {
	const cell = slot.data;
	const targetBoardItemId =
		targetTile?.data.kind === "board-item"
			? board.byId[targetTile.data.boardItemId]?.id
			: undefined;
	return {
		data: {
			kind: "cell" as const,
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
};

const readBoardDropFeedbackForRuntimeSnapshot = ({
	context,
	runtimeStore,
}: {
	context: Parameters<NonNullable<BoardTileEngineDragConfig["dropFeedback"]>>[0];
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) => {
	const snapshot = runtimeStore.getSnapshot();
	const nowMs = Date.now();

	return resolveBoardDropFeedback({
		board: readBoardView(snapshot, nowMs),
		config: snapshot.runtime.config,
		context,
		inventory: readInventoryView(snapshot),
	});
};

const useOpenBoardItemSheet = ({
	onOpenSheet,
	runtimeStore,
}: {
	onOpenSheet(sheet: ActiveSheetState): void;
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) =>
	useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const snapshot = runtimeStore.getSnapshot();
			const liveBoardItem = readExpectedBoardViewItem({
				board: readBoardView(snapshot, Date.now()),
				expectedItemId,
				itemInstanceId: boardItemId,
			});
			if (!liveBoardItem) return;

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

const useBoardDragConfig = ({
	actions,
	activateBoardItem,
	audio,
	board,
	feedback,
	onOpenSheet,
	openBoardItemSheet,
	runtimeStore,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	activateBoardItem: useBoardItemActivation.Result;
	audio: ReturnType<typeof useGameAudio>;
	board: ReturnType<typeof useGameBoardView>;
	feedback: Feedback.Type;
	onOpenSheet(sheet: ActiveSheetState): void;
	openBoardItemSheet(boardItemId: string, expectedItemId: string): void;
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}): BoardTileEngineDragConfig =>
	useMemo(
		() => ({
			tile: (tile) =>
				readBoardTileDragActor({
					activateBoardItem,
					audio,
					board,
					openBoardItemSheet,
					tile,
				}),
			slot: (slot, targetTile) =>
				readBoardCellDropTarget({
					audio,
					board,
					onOpenSheet,
					slot,
					targetTile,
				}),
			dropFeedback: (context) =>
				readBoardDropFeedbackForRuntimeSnapshot({
					context,
					runtimeStore,
				}),
			...createRuntimeDropLifecycle<BoardSurface.TileData, BoardCellView>({
				actions,
				audio,
				feedback,
				runtimeStore,
			}),
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
			onOpenSheet,
			openBoardItemSheet,
			runtimeStore,
		],
	);

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

	const slots = useBoardSurfaceSlots({
		boardLayout,
	});
	const tiles = useBoardSurfaceTiles({
		board,
		transientTiles,
	});
	const blockedCellKeys = useBlockedBoardCellKeys({
		board,
	});

	const openBoardItemSheet = useOpenBoardItemSheet({
		onOpenSheet,
		runtimeStore,
	});
	const activateBoardItem = useBoardItemActivation({
		feedback,
		onOpenSheet,
	});
	const drag = useBoardDragConfig({
		actions,
		activateBoardItem,
		audio,
		board,
		feedback,
		onOpenSheet,
		openBoardItemSheet,
		runtimeStore,
	});

	return {
		blockedCellKeys,
		columns: boardLayout.width,
		drag,
		slots,
		tiles,
	};
};
