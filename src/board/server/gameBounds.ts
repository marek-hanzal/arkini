import { GameActionError } from "~/play/server/playTypes";
import type { SaveShape } from "~/inventory/server/planning";
import { BoardCellSchema, InventorySlotIndexSchema } from "~/play/server/gameActionSchemas";

export function assertInsideBoard(save: SaveShape, x: number, y: number) {
  const result = BoardCellSchema.safeParse({ x, y });
  if (!result.success || x >= save.boardWidth || y >= save.boardHeight) {
    throw new GameActionError("Target cell is outside the board.");
  }
}

export function assertInsideInventory(save: SaveShape, slotIndex: number) {
  const result = InventorySlotIndexSchema.safeParse(slotIndex);
  if (!result.success || slotIndex >= save.inventorySlots) {
    throw new GameActionError("Inventory slot is outside the inventory.");
  }
}
