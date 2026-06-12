import { GameConfig } from "~/manifest/server/gameDataManifest";

export interface BoardCell {
  x: number;
  y: number;
}

export const boardColumns = GameConfig.game.board.width;
export const boardRows = GameConfig.game.board.height;
export const boardContainerNodeId = "board-container";

export function boardSourceId(boardItemId: string) {
  return `board:${boardItemId}`;
}

export function boardCellNodeId(x: number, y: number) {
  return `board-cell:${x}:${y}`;
}
