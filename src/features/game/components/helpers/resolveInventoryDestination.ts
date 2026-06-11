import type { GameView } from "~/domains/database";

export function resolveInventoryDestination(game: GameView, itemId: string, preferredSlotIndex?: number) {
  const item = game.items[itemId];
  if (!item) return null;

  const existingStack = game.inventoryStacksByItemId[itemId]?.find((slot) => (slot.stack?.quantity ?? 0) < item.maxStackSize);
  if (existingStack) return existingStack.slotIndex;

  if (preferredSlotIndex !== undefined) {
    const preferredSlot = game.inventoryBySlotIndex[preferredSlotIndex];
    if (preferredSlot && !preferredSlot.stack) return preferredSlotIndex;
  }

  return game.firstEmptyInventorySlotIndex;
}
