export function parseCellId(id: string | null | undefined) {
  if (!id?.startsWith("board:")) return null;
  const [, x, y] = id.split(":");
  return { x: Number(x), y: Number(y) };
}
