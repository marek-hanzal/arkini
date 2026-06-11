import type { GameView } from "~/domains/database";
import type { DragData } from "../types";
import { canStash } from "./canStash";
import { findInventorySlot } from "./findInventorySlot";

export function getPreviewSlot(game: GameView, activeDrag: DragData | null, activeOverId: string | null, nowMs: number) {
  if (!activeDrag || activeDrag.type !== "board" || !activeOverId?.startsWith("inventory:")) return null;
  const boardItem = game.boardItemsById[activeDrag.boardItemId];
  if (!boardItem) return null;
  if (!canStash(game, boardItem.id, nowMs)) return null;
  const preferredSlotIndex = Number(activeOverId.replace("inventory:", ""));
  return findInventorySlot(game, boardItem.itemId, preferredSlotIndex);
}
