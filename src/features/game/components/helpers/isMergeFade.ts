import type { GameView } from "~/domains/database";
import type { DragData } from "../types";
import { canMerge } from "./canMerge";
import { parseCellId } from "./parseCellId";

export function isMergeFade(game: GameView, activeDrag: DragData | null, activeOverId: string | null) {
  if (activeDrag?.type !== "board") return false;

  const targetCell = parseCellId(activeOverId);
  if (!targetCell) return false;

  const target = game.boardItemByCellKey[`${targetCell.x}:${targetCell.y}`];
  if (!target) return false;

  return canMerge(game, activeDrag.boardItemId, target.id);
}
