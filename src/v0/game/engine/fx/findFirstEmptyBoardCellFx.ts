import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { BoardCell } from "~/v0/game/engine/model/BoardCell";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace findFirstEmptyBoardCellFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
	}
}

export const findFirstEmptyBoardCellFx = Effect.fn("findFirstEmptyBoardCellFx")(function* ({
	config,
	save,
}: findFirstEmptyBoardCellFx.Props) {
	const occupiedCells = new Set(
		Object.values(save.board.items).map((item) => `${item.x}:${item.y}`),
	);

	for (let y = 0; y < config.game.board.height; y += 1) {
		for (let x = 0; x < config.game.board.width; x += 1) {
			if (!occupiedCells.has(`${x}:${y}`)) {
				return {
					x,
					y,
				} satisfies BoardCell;
			}
		}
	}

	return null;
});
