import { useMemo } from "react";
import { useGameAudio } from "~/audio/GameAudioProvider";
import { readBoardCellDropTarget } from "~/board/readBoardCellDropTarget";
import { readBoardTileDragActor } from "~/board/readBoardTileDragActor";
import { resolveBoardDropFeedback } from "~/board/drop/resolveBoardDropFeedback";
import { useBoardItemActivation } from "~/board/useBoardItemActivation";
import type { BoardTileEngineDragConfig } from "~/board/BoardTileEngineModelTypes";
import type { BoardCellView } from "~/board/boardCells";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { createRuntimeDropLifecycle } from "~/play/drag/createRuntimeDropLifecycle";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { readRuntimeViews } from "~/play/runtime/readRuntimeViews";
import type { GameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export const useBoardDragConfig = ({
	actions,
	activateBoardItem,
	audio,
	board,
	feedback,
	onOpenSheet,
	openBoardItemSheet,
	runtimeStore,
}: {
	actions: GameRuntimeDropActions;
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
			dropFeedback: (context) => {
				const { board: liveBoard, config, inventory } = readRuntimeViews(
					runtimeStore.getSnapshot(),
					Date.now(),
				);

				return resolveBoardDropFeedback({
					board: liveBoard,
					config,
					context,
					inventory,
				});
			},
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
