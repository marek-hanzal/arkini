import { gameDataIndex } from "~/manifest/server/gameDataIndex";
import type { ItemId } from "~/manifest/server/manifestId";
import { GameActionError } from "../gameplayTypes";

export function getPlanItem(itemId: string) {
  const item = gameDataIndex.itemsById.get(itemId as ItemId);
  if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
  return item;
}
