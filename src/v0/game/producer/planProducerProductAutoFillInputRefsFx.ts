import { Effect } from "effect";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";

export namespace planProducerProductAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		producerItemInstanceId: string;
		productId: string;
		save: GameSave;
	}
}

const sortBoardInputCandidates = (items: readonly GameSave["board"]["items"][string][]) =>
	[
		...items,
	].sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);

export const planProducerProductAutoFillInputRefsFx = Effect.fn(
	"planProducerProductAutoFillInputRefsFx",
)(function* ({
	inputs,
	producerItemInstanceId,
	productId,
	save,
}: planProducerProductAutoFillInputRefsFx.Props) {
	const storedInputs = yield* readProducerProductStoredInputQuantitiesFx({
		producerItemInstanceId,
		productId,
		save,
	});
	const inputRefs: GameActionItemRef[] = [];
	const reservedBoardItemIds = new Set<string>();
	const reservedInventorySlotQuantities = new Map<number, number>();

	for (const input of inputs) {
		let missingQuantity = input.quantity - (storedInputs.get(input.itemId) ?? 0);
		if (missingQuantity <= 0) continue;

		for (const boardItem of sortBoardInputCandidates(Object.values(save.board.items))) {
			if (missingQuantity <= 0) break;
			if (boardItem.id === producerItemInstanceId) continue;
			if (boardItem.itemId !== input.itemId) continue;
			if (reservedBoardItemIds.has(boardItem.id)) continue;

			reservedBoardItemIds.add(boardItem.id);
			inputRefs.push({
				itemInstanceId: boardItem.id,
				kind: "board",
			});
			missingQuantity -= 1;
		}

		for (const [slotIndex, slot] of save.inventory.slots.entries()) {
			if (missingQuantity <= 0) break;
			if (!slot || slot.itemId !== input.itemId) continue;

			const reservedQuantity = reservedInventorySlotQuantities.get(slotIndex) ?? 0;
			const availableQuantity = readGameSaveInventorySlotQuantity(slot) - reservedQuantity;
			const quantity = Math.min(missingQuantity, availableQuantity);
			if (quantity <= 0) continue;

			reservedInventorySlotQuantities.set(slotIndex, reservedQuantity + quantity);
			inputRefs.push({
				kind: "inventory",
				quantity,
				slotIndex,
			});
			missingQuantity -= quantity;
		}
	}

	return inputRefs;
});
