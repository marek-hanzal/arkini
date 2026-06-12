import { GameActionError } from "../gameplayTypes";
import type { SaveShape } from "./types";

export function assertInsideInventory(save: SaveShape, slotIndex: number) {
  if (slotIndex < 0 || slotIndex >= save.inventorySlots) {
    throw new GameActionError("Inventory slot is outside the inventory.");
  }
}
