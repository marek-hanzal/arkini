import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import type { ItemId } from "~/manifest/data/manifestId";
import { GameActionError } from "~/play/logic/playTypes";

export function getPlanItem(itemId: string) {
  const item = gameDataIndex.itemsById.get(itemId as ItemId);
  if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
  return item;
}
