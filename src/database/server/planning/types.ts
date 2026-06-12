import type { ItemId } from "~/manifest/server";

export interface SaveShape {
  boardWidth: number;
  boardHeight: number;
  inventorySlots: number;
}

export type BoardRow = { id: string; itemDefinitionId: string; x: number; y: number; stateJson: string };
export type InventoryRow = { id: string; itemDefinitionId: string; slotIndex: number; quantity: number };

export interface PlacementPlan {
  board: { itemId: ItemId; x: number; y: number }[];
  inventory: InventoryPlacementPlan[];
}

export type InventoryPlacementPlan =
  | { type: "update"; stackId: string; slotIndex: number; itemId: ItemId; quantity: number }
  | { type: "insert"; stackId: string; slotIndex: number; itemId: ItemId; quantity: number };
