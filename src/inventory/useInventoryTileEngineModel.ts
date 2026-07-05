import { useGameAudio } from "~/audio/GameAudioProvider";
import { useInventoryDragConfig } from "~/inventory/useInventoryDragConfig";
import { useInventorySurfaceSlots } from "~/inventory/useInventorySurfaceSlots";
import { useInventorySurfaceTiles } from "~/inventory/useInventorySurfaceTiles";
import { usePlaceInventoryOnBoard } from "~/inventory/usePlaceInventoryOnBoard";
import type {
	InventoryPlacementTarget,
	InventoryTileEngineDragConfig,
} from "~/inventory/InventoryTileEngineModelTypes";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeSelector, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useInventoryTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
		placementTarget?: InventoryPlacementTarget;
	}

	export interface Result {
		slots: TileEngine.Slot<InventorySurface.SlotData>[];
		tiles: TileEngine.Tile<InventorySurface.TileData>[];
		columns: number;
		drag: InventoryTileEngineDragConfig;
	}
}

export const useInventoryTileEngineModel = ({
	feedback,
	placementTarget,
}: useInventoryTileEngineModel.Props): useInventoryTileEngineModel.Result => {
	const audio = useGameAudio();
	const inventory = useGameInventoryView();
	const columns = useGameRuntimeSelector((state) => state.runtime.config.game.board.width);
	const actions = useGameRuntimeDropActions();
	const runtimeStore = useGameRuntimeStore();
	const slots = useInventorySurfaceSlots({
		inventory,
	});
	const tiles = useInventorySurfaceTiles({
		inventory,
	});
	const placeInventoryOnBoard = usePlaceInventoryOnBoard({
		actions,
		feedback,
		placementTarget,
		runtimeStore,
	});
	const drag = useInventoryDragConfig({
		actions,
		audio,
		feedback,
		inventory,
		placeInventoryOnBoard,
		runtimeStore,
	});

	return {
		columns,
		drag,
		slots,
		tiles,
	};
};
