import type { GameView } from "@arkini/db";
import type { DragData } from "../types";
import { resolveInventoryDestination } from "./resolveInventoryDestination";

export function getInventoryPreviewSlot(game: GameView, activeDrag: DragData | null, activeOverId: string | null) {
  if (!activeDrag || activeDrag.type !== "board" || !activeOverId?.startsWith("inventory:")) return null;
  const boardItem = game.boardItems.find((item) => item.id === activeDrag.boardItemId);
  if (!boardItem) return null;
  const preferredSlotIndex = Number(activeOverId.replace("inventory:", ""));
  return resolveInventoryDestination(game, boardItem.itemId, preferredSlotIndex);
}
