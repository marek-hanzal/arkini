import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readInventorySlotAfterQuantityRemovalFx } from "~/inventory/readInventorySlotAfterQuantityRemovalFx";

export const readSaveAfterInventoryRemovalPreviewFx = Effect.fn(
	"readSaveAfterInventoryRemovalPreviewFx",
)(function* ({
	quantity,
	save,
	slotIndex,
}: {
	quantity: number;
	save: GameSave;
	slotIndex: number;
}) {
	const slots = [];
	for (const [index, slot] of save.inventory.slots.entries()) {
		slots.push(
			index === slotIndex
				? yield* readInventorySlotAfterQuantityRemovalFx({
						quantity,
						slot,
					})
				: slot,
		);
	}

	return {
		...save,
		inventory: {
			...save.inventory,
			slots,
		},
	};
});
