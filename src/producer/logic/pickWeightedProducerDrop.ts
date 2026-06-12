import type { ProducerDrop } from "~/manifest/data/producer";
import { GameActionError } from "~/play/logic/playTypes";

export function pickWeightedProducerDrop(entries: readonly ProducerDrop[]) {
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
