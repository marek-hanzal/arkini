import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeActivationRequirementViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";

const readRuntimeStashInputAvailableQuantityFromGameSave = ({
	itemId,
	save,
	targetItemInstanceId,
}: {
	itemId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => {
	const boardQuantity = Object.values(save.board.items).filter(
		(item) => item.id !== targetItemInstanceId && item.itemId === itemId,
	).length;
	const inventoryQuantity = save.inventory.slots.reduce((total, slot) => {
		if (!slot || slot.itemId !== itemId) return total;
		return total + readGameSaveInventorySlotQuantity(slot);
	}, 0);

	return boardQuantity + inventoryQuantity;
};

export namespace readRuntimeStashActivationViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		save: GameSave;
	}
}

export const readRuntimeStashActivationViewFromGameSave = ({
	boardItem,
	config,
	save,
}: readRuntimeStashActivationViewFromGameSave.Props): ActivationView | undefined => {
	const item = config.items[boardItem.itemId];
	const stashId = item?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;
	if (!stashId || !stash) return undefined;

	return {
		inputs: stash.inputs.map((input) =>
			readRuntimeActivationInputView({
				available: readRuntimeStashInputAvailableQuantityFromGameSave({
					itemId: input.itemId,
					save,
					targetItemInstanceId: boardItem.id,
				}),
				input,
				stored: 0,
			}),
		),
		kind: "stash",
		remainingCharges: save.stashes[boardItem.id]?.remainingCharges ?? stash.charges,
		requirements: readRuntimeActivationRequirementViewsFromGameSave({
			requirements: stash.requirements,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		trigger: "click",
	};
};
