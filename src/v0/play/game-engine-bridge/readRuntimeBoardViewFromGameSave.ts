import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readRuntimeBoardItemViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardItemViewFromGameSave";

export { readRuntimeBoardItemViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardItemViewFromGameSave";

export namespace readRuntimeBoardViewFromGameSave {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeBoardViewFromGameSave = ({
	config,
	nowMs,
	save,
}: readRuntimeBoardViewFromGameSave.Props): BoardView => {
	const items = Object.values(save.board.items)
		.sort(
			(left, right) =>
				left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
		)
		.flatMap((boardItem) => {
			const view = readRuntimeBoardItemViewFromGameSave({
				boardItemId: boardItem.id,
				config,
				nowMs,
				save,
			});

			return view
				? [
						view,
					]
				: [];
		});

	return rebuildBoardView(items, config.game.board);
};
