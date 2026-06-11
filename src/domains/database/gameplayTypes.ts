import type { BuildRecipeCost } from "~/domains/game-data";

export interface GameView {
  save: { id: string; boardWidth: number; boardHeight: number; inventorySlots: number };
  items: Record<string, ViewItem>;
  boardItems: BoardViewItem[];
  boardItemsById: Record<string, BoardViewItem>;
  boardItemByCellKey: Record<string, BoardViewItem>;
  inventory: InventorySlot[];
  inventoryBySlotIndex: Record<number, InventorySlot>;
  inventoryStacksByItemId: Record<string, InventorySlot[]>;
  firstEmptyInventorySlotIndex: number | null;
  buildRecipes: BuildRecipeView[];
}

export interface ViewItem {
  id: string;
  name: string;
  description: string;
  assetSrc: string;
  maxStackSize: number;
  tags: string[];
  canProduce: boolean;
  canMerge: boolean;
  producerCooldownMs: number | null;
}

export interface BoardViewItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  state: BoardItemState;
}

export interface InventorySlot {
  slotIndex: number;
  stack: { id: string; itemId: string; quantity: number } | null;
}

export interface BuildRecipeView {
  id: string;
  blueprintItemId: string;
  resultItemId: string;
  costs: BuildRecipeCost[];
  canBuild: boolean;
}

export interface ProducerDropResult {
  producerBoardItemId: string;
  drops: { boardItemId: string; itemId: string; x: number; y: number }[];
}

export interface BoardItemState {
  producer?: {
    cooldownUntil?: string;
    remainingCharges?: number | null;
  };
}

export class GameActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameActionError";
  }
}
