import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type {
	GameSave,
	GameSaveInventoryInstance,
	GameSaveInventoryStack,
} from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export interface PlaceInventoryItemOnBoardProps {
	action: GameActionInventoryItemPlaceSchema.Type;
	config: GameConfig;
	save: GameSave;
	nowMs: number;
}

export type InventoryPlacementMode = NonNullable<
	GameActionInventoryItemPlaceSchema.Type["placementMode"]
>;

export type InventoryPlacementState = {
	consumedEvent: GameEvent;
	itemId: string;
	liveSlot: GameSaveInventoryInstance | GameSaveInventoryStack;
	nextSave: GameSave;
	placedCreatedAtMs: number | undefined;
	placementMode: InventoryPlacementMode;
	quantity: number;
};

export type InventoryPlacementStackState = InventoryPlacementState & {
	liveSlot: GameSaveInventoryStack;
};
