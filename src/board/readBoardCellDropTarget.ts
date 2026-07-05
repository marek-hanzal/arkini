import { useGameAudio } from "~/audio/GameAudioProvider";
import type {
	BoardTileEngineSlot,
	BoardTileEngineTargetTile,
} from "~/board/BoardTileEngineModelTypes";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export const readBoardCellDropTarget = ({
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
