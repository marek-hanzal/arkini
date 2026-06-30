import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readRuntimeActivationViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationViewFromGameSave";
import { readRuntimeCraftViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeCraftViewFromGameSave";

export namespace readRuntimeBoardItemViewFromGameSave {
	export interface Props {
		boardItemId: string;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeBoardItemViewFromGameSave = ({
	boardItemId,
	config,
	nowMs,
	save,
}: readRuntimeBoardItemViewFromGameSave.Props): BoardViewItem | undefined => {
	const boardItem = save.board.items[boardItemId];
	if (!boardItem) return undefined;

	return {
		activation: readRuntimeActivationViewFromGameSave({
			boardItem,
			config,
			nowMs,
			save,
		}),
		craft: readRuntimeCraftViewFromGameSave({
			boardItem,
			config,
			nowMs,
			save,
		}),
		id: boardItem.id,
		itemId: boardItem.itemId as ItemId,
		state: {},
		x: boardItem.x,
		y: boardItem.y,
	};
};
