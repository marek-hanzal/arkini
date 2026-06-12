export interface BoardCell {
  x: number;
  y: number;
}

export const boardColumns = 7;
export const boardRows = 9;
export const boardContainerNodeId = "board-container";

export function boardSourceId(boardItemId: string) {
  return `board:${boardItemId}`;
}

export function boardCellNodeId(x: number, y: number) {
  return `board-cell:${x}:${y}`;
}
