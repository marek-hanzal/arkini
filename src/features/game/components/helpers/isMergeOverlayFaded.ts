import type { GameView } from "~/domains/database";
import type { DragData } from "../types";
import { canMergeBoardItems } from "./canMergeBoardItems";
import { parseBoardCellId } from "./boardCellId";

export function isMergeOverlayFaded(game: GameView, activeDrag: DragData | null, activeOverId: string | null) {
  if (activeDrag?.type !== "board") return false;

  const targetCell = parseBoardCellId(activeOverId);
  if (!targetCell) return false;

  const target = game.boardItemByCellKey[`${targetCell.x}:${targetCell.y}`];
  if (!target) return false;

  return canMergeBoardItems(game, activeDrag.boardItemId, target.id);
}
