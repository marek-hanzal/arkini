import type { GameView } from "@arkini/db";

export function findFirstFreeBoardCell(game: GameView) {
  const occupied = new Set(game.boardItems.map((item) => `${item.x}:${item.y}`));

  for (let y = 0; y < game.save.boardHeight; y += 1) {
    for (let x = 0; x < game.save.boardWidth; x += 1) {
      if (!occupied.has(`${x}:${y}`)) {
        return { x, y };
      }
    }
  }

  return null;
}
