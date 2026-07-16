import { Effect } from "effect";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import { isBoardItemConsumableAsInput } from "~/activation/isBoardItemConsumableAsInput";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/inventory/model/GameSaveInventorySlot";
import { type GameItemQuantityIndex, readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

interface ActivationInputDemand {
	itemId: string;
	quantity: number;
	mode?: "exact" | "upTo";
}

export namespace planActivationInputRefsFx {
	export interface Props {
		excludedBoardItemIds?: ReadonlySet<string>;
		inputs: readonly ActivationInputDemand[];
		save: GameSave;
		storedInputQuantities: GameItemQuantityIndex;
	}
}

type ActivationInputPlannerState = {
	inputRefs: GameActionItemRef[];
	reservedBoardItemQuantities: Record<string, number>;
	reservedInventorySlotQuantities: number[];
};

const createActivationInputPlannerState = (): ActivationInputPlannerState => ({
	inputRefs: [],
	reservedBoardItemQuantities: {},
	reservedInventorySlotQuantities: [],
});

const readSortedBoardInputCandidates = (items: readonly GameSave["board"]["items"][string][]) =>
	[
		...items,
	].sort(
		(left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
	);

const readMissingActivationInputQuantity = ({
	input,
	storedInputQuantities,
}: {
	input: ActivationInputDemand;
	storedInputQuantities: GameItemQuantityIndex;
}) =>
	input.quantity -
	readGameItemQuantity({
		itemId: input.itemId,
		quantities: storedInputQuantities,
	});

const appendBoardActivationInputRefsFx = Effect.fn("appendBoardActivationInputRefsFx")(function* ({
	excludedBoardItemIds,
	input,
	missingQuantity,
	save,
	state,
}: {
	excludedBoardItemIds: ReadonlySet<string>;
	input: ActivationInputDemand;
	missingQuantity: number;
	save: GameSave;
	state: ActivationInputPlannerState;
}) {
	let remainingQuantity = missingQuantity;

	for (const boardItem of readSortedBoardInputCandidates(Object.values(save.board.items))) {
		if (remainingQuantity <= 0) break;
		if (excludedBoardItemIds.has(boardItem.id)) continue;
		if (boardItem.itemId !== input.itemId) continue;
		const reservedQuantity = state.reservedBoardItemQuantities[boardItem.id] ?? 0;
		const availableQuantity = readGameSaveBoardItemQuantity(boardItem) - reservedQuantity;
		const quantity = Math.min(remainingQuantity, availableQuantity);
		if (quantity <= 0) continue;
		if (
			!isBoardItemConsumableAsInput({
				itemInstanceId: boardItem.id,
				save,
			})
		) {
			continue;
		}

		state.reservedBoardItemQuantities[boardItem.id] = reservedQuantity + quantity;
		state.inputRefs.push({
			itemInstanceId: boardItem.id,
			kind: "board",
			quantity,
		});
		remainingQuantity -= quantity;
	}

	return remainingQuantity;
});

const appendInventoryActivationInputRefsFx = Effect.fn("appendInventoryActivationInputRefsFx")(
	function* ({
		input,
		missingQuantity,
		save,
		state,
	}: {
		input: ActivationInputDemand;
		missingQuantity: number;
		save: GameSave;
		state: ActivationInputPlannerState;
	}) {
		let remainingQuantity = missingQuantity;

		for (const [slotIndex, slot] of save.inventory.slots.entries()) {
			if (remainingQuantity <= 0) break;
			if (!slot || slot.itemId !== input.itemId) continue;

			const reservedQuantity = state.reservedInventorySlotQuantities[slotIndex] ?? 0;
			const availableQuantity = readGameSaveInventorySlotQuantity(slot) - reservedQuantity;
			const quantity = Math.min(remainingQuantity, availableQuantity);
			if (quantity <= 0) continue;

			state.reservedInventorySlotQuantities[slotIndex] = reservedQuantity + quantity;
			state.inputRefs.push({
				kind: "inventory",
				quantity,
				slotIndex,
			});
			remainingQuantity -= quantity;
		}

		return remainingQuantity;
	},
);

const appendActivationInputRefsFx = Effect.fn("appendActivationInputRefsFx")(function* ({
	excludedBoardItemIds,
	input,
	save,
	state,
	storedInputQuantities,
}: {
	excludedBoardItemIds: ReadonlySet<string>;
	input: ActivationInputDemand;
	save: GameSave;
	state: ActivationInputPlannerState;
	storedInputQuantities: GameItemQuantityIndex;
}) {
	const missingQuantity = readMissingActivationInputQuantity({
		input,
		storedInputQuantities,
	});
	if (missingQuantity <= 0) return;

	const afterBoardQuantity = yield* appendBoardActivationInputRefsFx({
		excludedBoardItemIds,
		input,
		missingQuantity,
		save,
		state,
	});
	yield* appendInventoryActivationInputRefsFx({
		input,
		missingQuantity: afterBoardQuantity,
		save,
		state,
	});
});

export const planActivationInputRefsFx = Effect.fn("planActivationInputRefsFx")(function* ({
	excludedBoardItemIds = new Set(),
	inputs,
	save,
	storedInputQuantities,
}: planActivationInputRefsFx.Props) {
	const state = createActivationInputPlannerState();

	for (const input of inputs) {
		yield* appendActivationInputRefsFx({
			excludedBoardItemIds,
			input,
			save,
			state,
			storedInputQuantities,
		});
	}

	return state.inputRefs;
});
