import type { GameView } from "~/domains/database";

export function findFirstFreeBoardCell(game: GameView) {
  const occupied = new Set(Object.keys(game.boardItemByCellKey));

  for (let y = 0; y < game.save.boardHeight; y += 1) {
    for (let x = 0; x < game.save.boardWidth; x += 1) {
      if (!occupied.has(`${x}:${y}`)) {
        return { x, y };
      }
    }
  }

  return null;
}
