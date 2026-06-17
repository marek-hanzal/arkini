import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export interface BoardCell {
	x: number;
	y: number;
}

export const findFirstEmptyBoardCell = (config: GameConfig, save: GameSave): BoardCell | null => {
	const occupiedCells = new Set(
		Object.values(save.board.items).map((item) => `${item.x}:${item.y}`),
	);

	for (let y = 0; y < config.game.board.height; y += 1) {
		for (let x = 0; x < config.game.board.width; x += 1) {
			if (!occupiedCells.has(`${x}:${y}`)) {
				return {
					x,
					y,
				};
			}
		}
	}

	return null;
};
