import type { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import { cellKey } from "~/v0/board/cellKey";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readBoardFirstEmptyCell = (
	state: GameRuntimeState,
): BoardCellSchema.Type | undefined => {
	const { width, height } = state.runtime.config.game.board;
	const occupied = new Set(
		Object.values(state.runtime.save.board.items).map((item) => cellKey(item.x, item.y)),
	);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!occupied.has(cellKey(x, y))) {
				return {
					x,
					y,
				};
			}
		}
	}

	return undefined;
};
