import { useGameAudio } from "~/audio/GameAudioProvider";
import { useBoardItemActivation } from "~/board/useBoardItemActivation";
import type { BoardTileEngineTile } from "~/board/BoardTileEngineModelTypes";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";

export const readBoardTileDragActor = ({
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
