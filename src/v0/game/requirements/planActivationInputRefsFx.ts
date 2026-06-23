import { Effect } from "effect";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import {
	type GameItemQuantityIndex,
	readGameItemQuantity,
} from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace planActivationInputRefsFx {
	export interface InputRequirement {
		itemId: string;
		quantity: number;
	}

	export interface Props {
		excludedBoardItemIds?: ReadonlySet<string>;
		inputs: readonly InputRequirement[];
		save: GameSave;
		storedInputQuantities: GameItemQuantityIndex;
	}
}

const sortBoardInputCandidates = (items: readonly GameSave["board"]["items"][string][]) =>
	[
		...items,
	].sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);

const isBoardInputConsumable = ({
	itemInstanceId,
	save,
}: {
	itemInstanceId: string;
	save: GameSave;
}) => {
	const status = readBoardItemRuntimeStateStatus({
		itemInstanceId,
		save,
	});
	return !status.busy && !status.preservable;
};

export const planActivationInputRefsFx = Effect.fn("planActivationInputRefsFx")(function* ({
	excludedBoardItemIds = new Set(),
	inputs,
	save,
	storedInputQuantities,
}: planActivationInputRefsFx.Props) {
	const inputRefs: GameActionItemRef[] = [];
	const reservedBoardItemIds = new Set<string>();
	const reservedInventorySlotQuantities: number[] = [];

	for (const input of inputs) {
		let missingQuantity =
			input.quantity -
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputQuantities,
			});
		if (missingQuantity <= 0) continue;

		for (const boardItem of sortBoardInputCandidates(Object.values(save.board.items))) {
			if (missingQuantity <= 0) break;
			if (excludedBoardItemIds.has(boardItem.id)) continue;
			if (boardItem.itemId !== input.itemId) continue;
			if (reservedBoardItemIds.has(boardItem.id)) continue;
			if (
				!isBoardInputConsumable({
					itemInstanceId: boardItem.id,
					save,
				})
			) {
				continue;
			}

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

			const reservedQuantity = reservedInventorySlotQuantities[slotIndex] ?? 0;
			const availableQuantity = readGameSaveInventorySlotQuantity(slot) - reservedQuantity;
			const quantity = Math.min(missingQuantity, availableQuantity);
			if (quantity <= 0) continue;

			reservedInventorySlotQuantities[slotIndex] = reservedQuantity + quantity;
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
