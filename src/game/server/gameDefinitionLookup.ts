import { gameDataIndex } from "~/manifest/server/gameDataIndex";
import type { ItemId } from "~/manifest/server/manifestId";
import { GameActionError } from "./gameplayTypes";

export function getItem(itemId: string) {
  const item = gameDataIndex.itemsById.get(itemId as ItemId);
  if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
  return item;
}

export function getProducer(itemId: string) {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  if (!producer) throw new GameActionError("This item is not a producer.");
  return producer;
}
