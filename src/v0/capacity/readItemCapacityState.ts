import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export interface ItemCapacityStateView {
	itemId: string;
	max: number;
	remaining: number;
}

const readSaveItemId = ({ itemInstanceId, save }: { itemInstanceId: string; save: GameSave }) => {
	const boardItem = save.board.items[itemInstanceId];
	if (boardItem) return boardItem.itemId;

	for (const slot of save.inventory.slots) {
		if (slot && "kind" in slot && slot.kind === "instance" && slot.id === itemInstanceId) {
			return slot.itemId;
		}
	}

	return undefined;
};

export const readItemCapacityState = ({
	config,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	itemInstanceId: string;
	save: GameSave;
}): ItemCapacityStateView | undefined => {
	const itemId = readSaveItemId({
		itemInstanceId,
		save,
	});
	if (!itemId) return undefined;

	const capacity = config.items[itemId]?.capacity;
	if (!capacity) return undefined;

	return {
		itemId,
		max: capacity.max,
		remaining: save.itemCapacities[itemInstanceId]?.remaining ?? capacity.max,
	};
};
