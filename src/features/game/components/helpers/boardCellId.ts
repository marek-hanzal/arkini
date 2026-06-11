export function boardCellId(x: number, y: number) {
  return `board:${x}:${y}`;
}

export function boardCellKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function parseBoardCellId(id: string | null) {
  if (!id?.startsWith("board:")) return null;

  const [, x, y] = id.split(":");
  const parsedX = Number(x);
  const parsedY = Number(y);

  if (!Number.isInteger(parsedX) || !Number.isInteger(parsedY)) return null;

  return { x: parsedX, y: parsedY };
}
