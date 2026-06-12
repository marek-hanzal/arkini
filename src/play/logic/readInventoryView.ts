import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "./save";
import { readGameSaveView } from "./readGameSaveView";
import type { InventorySlot, InventoryView } from "./playTypes";

export async function readInventoryView(): Promise<InventoryView> {
  const [save, inventoryRows] = await Promise.all([
    readGameSaveView(),
    db
      .selectFrom(table.inventoryStack)
      .selectAll()
      .where("saveGameId", "=", defaultSaveGameId)
      .orderBy("slotIndex")
      .execute(),
  ]);

  const stackBySlotIndex = new Map(inventoryRows.map((stack) => [stack.slotIndex, stack]));
  const slots = Array.from({ length: save.inventorySlots }, (_, slotIndex): InventorySlot => {
    const stack = stackBySlotIndex.get(slotIndex);
    return {
      slotIndex,
      stack: stack ? { id: stack.id, itemId: stack.itemDefinitionId, quantity: stack.quantity } : null,
    };
  });

  return {
    slots,
    bySlotIndex: Object.fromEntries(slots.map((slot) => [slot.slotIndex, slot])),
    stacksByItemId: groupSlotsByItemId(slots),
    firstEmptySlotIndex: slots.find((slot) => !slot.stack)?.slotIndex ?? null,
  };
}

function groupSlotsByItemId(slots: readonly InventorySlot[]) {
  return slots.reduce<Record<string, InventorySlot[]>>((byItemId, slot) => {
    if (!slot.stack) return byItemId;
    byItemId[slot.stack.itemId] ??= [];
    byItemId[slot.stack.itemId].push(slot);
    return byItemId;
  }, {});
}
