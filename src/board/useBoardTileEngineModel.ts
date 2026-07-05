import { useBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import { useBlockedBoardCellKeys } from "~/board/useBlockedBoardCellKeys";
import { useBoardDragConfig } from "~/board/useBoardDragConfig";
import { useBoardItemActivation } from "~/board/useBoardItemActivation";
import { useBoardSurfaceSlots } from "~/board/useBoardSurfaceSlots";
import { useBoardSurfaceTiles } from "~/board/useBoardSurfaceTiles";
import type { BoardTileEngineDragConfig } from "~/board/BoardTileEngineModelTypes";
import type { BoardCellView } from "~/board/boardCells";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { useOpenBoardItemSheet } from "~/board/useOpenBoardItemSheet";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameBoardView } from "~/play/runtime/useGameRuntimeViews";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { useGameAudio } from "~/audio/GameAudioProvider";

export namespace useBoardTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		onOpenSheet(sheet: ActiveSheetState): void;
	}

	export interface Result {
		tiles: TileEngine.Tile<BoardSurface.TileData>[];
		drag: BoardTileEngineDragConfig;
		blockedCellKeys: readonly string[];
		columns: number;
		slots: TileEngine.Slot<BoardCellView>[];
	}
}

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
