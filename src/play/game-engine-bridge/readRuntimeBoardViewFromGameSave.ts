import type { BoardView } from "~/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readRuntimeBoardItemViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardItemViewFromGameSave";

export { readRuntimeBoardItemViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardItemViewFromGameSave";

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
