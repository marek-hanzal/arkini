import { GameActionError } from "./gameplayTypes";
import type { SaveShape } from "./planning";

export function assertInsideBoard(save: SaveShape, x: number, y: number) {
  if (x < 0 || y < 0 || x >= save.boardWidth || y >= save.boardHeight) {
    throw new GameActionError("Target cell is outside the board.");
  }
}

export function assertInsideInventory(save: SaveShape, slotIndex: number) {
  if (slotIndex < 0 || slotIndex >= save.inventorySlots) {
    throw new GameActionError("Inventory slot is outside the inventory.");
  }
}
