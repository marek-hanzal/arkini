import { useMemo } from "react";
import { useGameAudio } from "~/audio/GameAudioProvider";
import { readInventoryDropFeedbackFromRuntimeSnapshot } from "~/inventory/readInventoryDropFeedbackFromRuntimeSnapshot";
import { readInventorySlotDropTarget } from "~/inventory/readInventorySlotDropTarget";
import { readInventoryTileDragActor } from "~/inventory/readInventoryTileDragActor";
import type {
	InventoryTileEngineDragConfig,
	PlaceInventoryOnBoardInput,
} from "~/inventory/InventoryTileEngineModelTypes";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import { createRuntimeDropLifecycle } from "~/play/drag/createRuntimeDropLifecycle";
import type { Feedback } from "~/play/feedback/Feedback";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { useGameRuntimeDropActions } from "~/play/runtime/useGameRuntimeDropActions";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";

export const useInventoryDragConfig = ({
	actions,
	audio,
	feedback,
	inventory,
	placeInventoryOnBoard,
	runtimeStore,
}: {
	actions: ReturnType<typeof useGameRuntimeDropActions>;
	audio: ReturnType<typeof useGameAudio>;
	feedback: Feedback.Type;
	inventory: ReturnType<typeof useGameInventoryView>;
	placeInventoryOnBoard(input: PlaceInventoryOnBoardInput): void;
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}): InventoryTileEngineDragConfig =>
	useMemo(
		() => ({
			tile: (tile) =>
				readInventoryTileDragActor({
					inventory,
					placeInventoryOnBoard,
					tile,
				}),
			slot: (slot) =>
				readInventorySlotDropTarget({
					slot,
				}),
			dropFeedback: (context) =>
				readInventoryDropFeedbackFromRuntimeSnapshot({
					context,
					runtimeStore,
				}),
			...createRuntimeDropLifecycle<InventorySurface.TileData, InventorySurface.SlotData>({
				actions,
				audio,
				feedback,
				runtimeStore,
			}),
		}),
		[
			actions,
			audio,
			feedback,
			inventory,
			placeInventoryOnBoard,
			runtimeStore,
		],
	);
