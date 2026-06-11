import type { GameView } from "~/domains/database";
import type { DragData } from "../types";
import { canStashBoardItem } from "./canStashBoardItem";
import { resolveInventoryDestination } from "./resolveInventoryDestination";

export function getInventoryPreviewSlot(game: GameView, activeDrag: DragData | null, activeOverId: string | null, nowMs: number) {
  if (!activeDrag || activeDrag.type !== "board" || !activeOverId?.startsWith("inventory:")) return null;
  const boardItem = game.boardItemsById[activeDrag.boardItemId];
  if (!boardItem) return null;
  if (!canStashBoardItem(game, boardItem.id, nowMs)) return null;
  const preferredSlotIndex = Number(activeOverId.replace("inventory:", ""));
  return resolveInventoryDestination(game, boardItem.itemId, preferredSlotIndex);
}
