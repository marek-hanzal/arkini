import type { BuildRecipeCost, BuildRecipeId, ItemId, ProducerMode } from "~/domains/game-data";

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
  label?: string;
  assetSrc: string;
  maxStackSize: number;
  tags: string[];
  canProduce: boolean;
  producerTrigger: "click" | "auto" | null;
  canMerge: boolean;
}

export interface BoardViewItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  state: BoardItemState;
  producer: ProducerView | null;
}

export interface InventorySlot {
  slotIndex: number;
  stack: { id: string; itemId: string; quantity: number } | null;
}

export interface BuildRecipeView {
  id: BuildRecipeId;
  blueprintItemId: ItemId;
  resultItemId: ItemId;
  costs: BuildRecipeCost[];
  canBuild: boolean;
}

export interface ProducerView {
  trigger: "click" | "auto";
  mode: ProducerMode;
  cooldownMs: number | null;
  doubleClickBehavior: "exhaust" | null;
  cooldownUntil: string | null;
  remainingCharges: number | null;
  paused: boolean;
  autoAvailable: number | null;
  nextDropAt: string | null;
  rechargeUntil: string | null;
}

export interface ProducerPlacement {
  kind: "board" | "inventory";
  itemId: ItemId;
  boardItemId?: string;
  x?: number;
  y?: number;
  slotIndex?: number;
}

export interface ProducerDropResult {
  producerBoardItemId: string;
  placements: ProducerPlacement[];
}

export interface AutoProducerResult extends ProducerDropResult {}

export interface BoardItemState {
  producer?: {
    cooldownUntil?: string | null;
    remainingCharges?: number | null;
    paused?: boolean;
    autoAvailable?: number | null;
    nextDropAt?: string | null;
    rechargeUntil?: string | null;
  };
}

export class GameActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameActionError";
  }
}
