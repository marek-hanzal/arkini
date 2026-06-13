import { GameConfigServiceLive } from "~/manifest/logic/GameConfigServiceLive";

export interface BoardCell {
	x: number;
	y: number;
}

export const boardColumns = GameConfigServiceLive.config.game.board.width;
export const boardRows = GameConfigServiceLive.config.game.board.height;
export const boardContainerNodeId = "board-container";

export function boardSourceId(boardItemId: string) {
	return `board:${boardItemId}`;
}

export function boardCellNodeId(x: number, y: number) {
	return `board-cell:${x}:${y}`;
}
