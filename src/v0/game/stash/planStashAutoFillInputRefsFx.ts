import { Effect } from "effect";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";

export namespace planStashAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		save: GameSave;
		stashItemInstanceId: string;
	}
}

const sortBoardInputCandidates = (items: readonly GameSave["board"]["items"][string][]) =>
	[
		...items,
	].sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);

export const planStashAutoFillInputRefsFx = Effect.fn("planStashAutoFillInputRefsFx")(
	function* ({ inputs, save, stashItemInstanceId }: planStashAutoFillInputRefsFx.Props) {
		const inputRefs: GameActionItemRef[] = [];
		const reservedBoardItemIds = new Set<string>();
		const reservedInventorySlotQuantities = new Map<number, number>();

		for (const input of inputs) {
			let missingQuantity = input.quantity;
			if (missingQuantity <= 0) continue;

			for (const boardItem of sortBoardInputCandidates(Object.values(save.board.items))) {
				if (missingQuantity <= 0) break;
				if (boardItem.id === stashItemInstanceId) continue;
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
	},
);
