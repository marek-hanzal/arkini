import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";

export namespace readRuntimeInventoryViewFromGameSave {
	export interface Props {
		config: GameConfig;
		save: GameSave;
	}
}

const emptyStateJson = "{}";

export const readRuntimeInventoryViewFromGameSave = ({
	config,
	save,
}: readRuntimeInventoryViewFromGameSave.Props): InventoryView =>
	rebuildInventoryView(
		Array.from(
			{
				length: config.game.inventory.slots,
			},
			(_, slotIndex): InventorySlot => {
				const stack = save.inventory.slots[slotIndex];

				return {
					slotIndex,
					stack: stack
						? {
								id: `runtime:inventory:${slotIndex}:${stack.itemId}`,
								itemId: stack.itemId as ItemId,
								quantity: stack.quantity,
								state: {},
								stateful: false,
								stateJson: emptyStateJson,
							}
						: undefined,
				};
			},
		),
	);
