import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";

export interface InventoryItemPlaceReadinessProps {
	action: GameActionInventoryItemPlaceSchema.Type;
	config: GameConfig;
	nowMs?: number;
	save: GameSave;
}

export type InventoryPlacementMode = NonNullable<
	GameActionInventoryItemPlaceSchema.Type["placementMode"]
>;

export type InventoryPlacementSlot = Exclude<GameSaveInventorySlot, null>;

export type InventoryPlacementDraft = {
	itemDefinition: GameConfig["items"][string];
	placementMode: InventoryPlacementMode;
	quantity: number;
	saveAfterInventoryRemoval: GameSave;
	slot: InventoryPlacementSlot;
};
