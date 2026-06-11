import type { GameView } from "~/domains/database";
import { match } from "ts-pattern";
import type { BoardItem, DragData, DropState } from "../types";
import { canMergeBoardItems } from "./canMergeBoardItems";

export function getBoardCellDropState(game: GameView, activeDrag: DragData | null, target: BoardItem | null): DropState {
  if (!activeDrag) return "neutral";

  return match(activeDrag)
    .with({ type: "inventory" }, () => (target ? "invalid" : "valid") as DropState)
    .with({ type: "board" }, ({ boardItemId }) => {
      if (!target) return "valid";
      if (target.id === boardItemId) return "neutral";
      return canMergeBoardItems(game, boardItemId, target.id) ? "valid" : "invalid";
    })
    .exhaustive();
}
