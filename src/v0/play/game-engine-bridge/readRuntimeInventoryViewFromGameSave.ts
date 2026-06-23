import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import { readRuntimeInventorySlotFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeInventorySlotFromGameSave";

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
