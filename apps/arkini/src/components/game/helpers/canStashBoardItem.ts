import type { GameView } from "@arkini/db";
import { getCooldown } from "./getCooldown";

export function canStashBoardItem(game: GameView, boardItemId: string, nowMs: number) {
  const boardItem = game.boardItems.find((item) => item.id === boardItemId);
  if (!boardItem) return false;

  const item = game.items[boardItem.itemId];
  if (!item?.canProduce) return true;

  return !getCooldown(item, boardItem, nowMs).coolingDown;
}
