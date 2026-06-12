import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerDrop, Quantity } from "~/manifest/data/producer";
import { GameActionError } from "~/play/logic/playTypes";

export function rollProducerDrops(entries: readonly ProducerDrop[]) {
  const entry = pickWeighted(entries);
  if (!entry.itemId) return [];

  const quantity = resolveQuantity(entry.quantity ?? 1);
  return Array.from({ length: quantity }, () => entry.itemId as ItemId);
}

function pickWeighted(entries: readonly ProducerDrop[]) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  const fallback = entries.at(-1);
  if (!fallback) throw new GameActionError("Producer has no drops.");
  return fallback;
}

function resolveQuantity(quantity: Quantity) {
  if (typeof quantity === "number") return quantity;
  return quantity.min + Math.floor(Math.random() * (quantity.max - quantity.min + 1));
}
