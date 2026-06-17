import { Effect } from "effect";
import type { GamePassiveRequirementScope } from "~/v0/game/engine/model/GamePassiveRequirementScope";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace countPassiveItemQuantityFx {
	export interface Props {
		itemId: string;
		save: GameSave;
		scope: GamePassiveRequirementScope;
	}
}

export const countPassiveItemQuantityFx = Effect.fn("countPassiveItemQuantityFx")(function* ({
	itemId,
	save,
	scope,
}: countPassiveItemQuantityFx.Props) {
	let quantity = 0;

	if (scope === "board" || scope === "board_or_inventory") {
		quantity += Object.values(save.board.items).filter((item) => item.itemId === itemId).length;
	}

	if (scope === "inventory" || scope === "board_or_inventory") {
		quantity += save.inventory.slots.reduce(
			(total, slot) => total + (slot?.itemId === itemId ? slot.quantity : 0),
			0,
		);
	}

	return quantity;
});
