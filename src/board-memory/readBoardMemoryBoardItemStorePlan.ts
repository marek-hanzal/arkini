import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import type { placeBoardItemInInventoryFx } from "~/placement/placeBoardItemInInventoryFx";

export namespace BoardMemoryBoardItemStorePlan {
	export type SkipReason = "busy" | "inventory-storage-forbidden" | "unknown-item";

	export interface Store {
		mode: placeBoardItemInInventoryFx.Props["mode"];
		type: "store";
	}

	export interface Skip {
		reason: SkipReason;
		type: "skip";
	}

	export type Type = Store | Skip;
}

export const readBoardMemoryBoardItemStorePlan = ({
	config,
	item,
	save,
}: {
	config: GameConfig;
	item: GameSaveBoardItem;
	save: GameSave;
}): BoardMemoryBoardItemStorePlan.Type => {
	if (!config.items[item.itemId]) {
		return {
			reason: "unknown-item",
			type: "skip",
		};
	}

	if (
		!isItemStorageAllowed({
			config,
			itemId: item.itemId,
			location: "inventory",
		})
	) {
		return {
			reason: "inventory-storage-forbidden",
			type: "skip",
		};
	}

	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: item.id,
		save,
	});
	if (stateStatus.busy) {
		return {
			reason: "busy",
			type: "skip",
		};
	}

	return {
		mode:
			stateStatus.preservable || item.itemId === boardMemoryItemId
				? "preserve-instance"
				: "stack-copy",
		type: "store",
	};
};
