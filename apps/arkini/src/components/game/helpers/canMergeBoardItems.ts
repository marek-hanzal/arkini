import type { GameView } from "@arkini/db";

export function canMergeBoardItems(game: GameView, sourceBoardItemId: string, targetBoardItemId: string) {
  if (sourceBoardItemId === targetBoardItemId) return false;
  const source = game.boardItems.find((item) => item.id === sourceBoardItemId);
  const target = game.boardItems.find((item) => item.id === targetBoardItemId);
  if (!source || !target) return false;
  return source.itemId === target.itemId && game.items[source.itemId]?.canMerge === true;
}
