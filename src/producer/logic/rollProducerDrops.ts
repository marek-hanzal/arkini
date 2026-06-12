import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerDrop } from "~/manifest/data/producer";
import { pickWeightedProducerDrop } from "~/producer/logic/pickWeightedProducerDrop";
import { resolveProducerDropQuantity } from "~/producer/logic/resolveProducerDropQuantity";

export function rollProducerDrops(entries: readonly ProducerDrop[]) {
  const entry = pickWeightedProducerDrop(entries);
  if (!entry.itemId) return [];

  const quantity = resolveProducerDropQuantity(entry.quantity ?? 1);
  return Array.from({ length: quantity }, () => entry.itemId as ItemId);
}
