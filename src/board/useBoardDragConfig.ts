import { useMemo } from "react";
import { useGameAudio } from "~/audio/GameAudioProvider";
import { readBoardCellDropTarget } from "~/board/readBoardCellDropTarget";
import { readBoardDropFeedbackForRuntimeSnapshot } from "~/board/readBoardDropFeedbackForRuntimeSnapshot";
import { readBoardTileDragActor } from "~/board/readBoardTileDragActor";
import { useBoardItemActivation } from "~/board/useBoardItemActivation";
import type { BoardTileEngineDragConfig } from "~/board/BoardTileEngineModelTypes";
import type { BoardCellView } from "~/board/boardCells";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { createRuntimeDropLifecycle } from "~/play/drag/createRuntimeDropLifecycle";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
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
