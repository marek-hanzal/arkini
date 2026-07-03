import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { ItemId } from "~/config/GameIdSchema";
import { readRuntimeActivationViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationViewFromGameSave";
import { readRuntimeCraftViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeCraftViewFromGameSave";
import { readItemCapacityState } from "~/capacity/readItemCapacityState";

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
		capacity: readItemCapacityState({
			config,
			itemInstanceId: boardItem.id,
			save,
		}),
		id: boardItem.id,
		itemId: boardItem.itemId as ItemId,
		state: {},
		x: boardItem.x,
		y: boardItem.y,
	};
};
