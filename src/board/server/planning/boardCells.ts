import type { SaveShape } from "~/inventory/server/planning";

export function findFreeBoardCells(save: SaveShape, boardRows: readonly { x: number; y: number }[], origin?: { x: number; y: number }) {
  const occupied = new Set(boardRows.map((item) => `${item.x}:${item.y}`));
  const cells: { x: number; y: number }[] = [];

  for (let y = 0; y < save.boardHeight; y += 1) {
    for (let x = 0; x < save.boardWidth; x += 1) {
      if (!occupied.has(`${x}:${y}`)) cells.push({ x, y });
    }
  }

  if (!origin) return cells;

  return cells.sort((a, b) => {
    const aDistance = manhattanDistance(a, origin);
    const bDistance = manhattanDistance(b, origin);

    if (aDistance !== bDistance) return aDistance - bDistance;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
