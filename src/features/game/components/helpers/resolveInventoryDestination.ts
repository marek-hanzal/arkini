import type { GameView } from "~/domains/database";

export function resolveInventoryDestination(game: GameView, itemId: string, preferredSlotIndex?: number) {
  const item = game.items[itemId];
  if (!item) return null;

  const existingStack = game.inventory.find((slot) => slot.stack?.itemId === itemId && slot.stack.quantity < item.maxStackSize);
  if (existingStack) return existingStack.slotIndex;

  if (preferredSlotIndex !== undefined) {
    const preferredSlot = game.inventory.find((slot) => slot.slotIndex === preferredSlotIndex);
    if (preferredSlot && !preferredSlot.stack) return preferredSlot.slotIndex;
  }

  return game.inventory.find((slot) => !slot.stack)?.slotIndex ?? null;
}
