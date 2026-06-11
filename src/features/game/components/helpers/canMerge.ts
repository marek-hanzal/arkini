import type { GameView } from "~/domains/database";

export function canMerge(game: GameView, sourceBoardItemId: string, targetBoardItemId: string) {
  if (sourceBoardItemId === targetBoardItemId) return false;
  const source = game.boardItemsById[sourceBoardItemId];
  const target = game.boardItemsById[targetBoardItemId];
  if (!source || !target) return false;
  return source.itemId === target.itemId && game.items[source.itemId]?.canMerge === true;
}
