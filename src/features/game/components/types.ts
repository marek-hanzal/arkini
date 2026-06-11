import type { GameView } from "~/domains/database";

export type Selection = { type: "board"; boardItemId: string } | null;

export type DragData =
  | { type: "inventory"; slotIndex: number }
  | { type: "board"; boardItemId: string }
  | { type: "build"; recipeId: string };

export type DropData =
  | { type: "board-cell"; x: number; y: number; boardItemId?: string }
  | { type: "inventory-slot"; slotIndex: number };

export type DropState = "neutral" | "valid" | "invalid";

export type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Flyout = {
  id: number;
  itemId: string;
  from: RectSnapshot;
  to: RectSnapshot;
};

export type ViewItem = GameView["items"][string];
export type BoardItem = GameView["boardItems"][number];
export type InventorySlot = GameView["inventory"][number];
