import type { BoardCellSchema } from "~/board/schema/BoardCellSchema";
import { cellKey } from "~/board/cellKey";
import { findFirstEmptyCell } from "~/board/logic/findFirstEmptyCell";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

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
