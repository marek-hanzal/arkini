import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import { readRuntimeInventorySlotFromGameSave } from "~/play/game-engine-bridge/readRuntimeInventorySlotFromGameSave";

export namespace readRuntimeInventoryViewFromGameSave {
	export interface Props {
		config: GameConfig;
		save: GameSave;
	}
}

export const readRuntimeInventoryViewFromGameSave = ({
	config,
	save,
}: readRuntimeInventoryViewFromGameSave.Props): InventoryView =>
	rebuildInventoryView(
		Array.from(
			{
				length: config.game.inventory.slots,
			},
			(_, slotIndex) =>
				readRuntimeInventorySlotFromGameSave({
					save,
					slotIndex,
				}),
		),
	);
