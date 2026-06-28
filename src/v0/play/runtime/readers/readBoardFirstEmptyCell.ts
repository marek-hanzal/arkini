import type { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import { cellKey } from "~/v0/board/cellKey";
import { findFirstEmptyCell } from "~/v0/board/logic/findFirstEmptyCell";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readBoardFirstEmptyCell = (
	state: GameRuntimeState,
): BoardCellSchema.Type | undefined => {
	const { width, height } = state.runtime.config.game.board;
	const occupied = new Set(
		Object.values(state.runtime.save.board.items).map((item) => cellKey(item.x, item.y)),
	);

	return findFirstEmptyCell({
		height,
		occupiedCellKeys: occupied,
		width,
	});
};
