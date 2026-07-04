import { Effect } from "effect";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import { isBoardItemConsumableAsInput } from "~/activation/isBoardItemConsumableAsInput";
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
	reservedBoardItemIds: Set<string>;
	reservedInventorySlotQuantities: number[];
};

type ActivationInputPlannerScope = Omit<planActivationInputRefsFx.Props, "excludedBoardItemIds"> & {
	excludedBoardItemIds: ReadonlySet<string>;
	state: ActivationInputPlannerState;
};

const createActivationInputPlannerState = (): ActivationInputPlannerState => ({
	inputRefs: [],
	reservedBoardItemIds: new Set<string>(),
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
	input,
	missingQuantity,
	scope,
}: {
	input: ActivationInputDemand;
	missingQuantity: number;
	scope: ActivationInputPlannerScope;
}) {
	let remainingQuantity = missingQuantity;

	for (const boardItem of readSortedBoardInputCandidates(Object.values(scope.save.board.items))) {
		if (remainingQuantity <= 0) break;
		if (scope.excludedBoardItemIds.has(boardItem.id)) continue;
		if (boardItem.itemId !== input.itemId) continue;
		if (scope.state.reservedBoardItemIds.has(boardItem.id)) continue;
		if (
			!isBoardItemConsumableAsInput({
				itemInstanceId: boardItem.id,
				save: scope.save,
			})
		) {
			continue;
		}

		scope.state.reservedBoardItemIds.add(boardItem.id);
		scope.state.inputRefs.push({
			itemInstanceId: boardItem.id,
			kind: "board",
		});
		remainingQuantity -= 1;
	}

	return remainingQuantity;
});

const appendInventoryActivationInputRefsFx = Effect.fn("appendInventoryActivationInputRefsFx")(
	function* ({
		input,
		missingQuantity,
		scope,
	}: {
		input: ActivationInputDemand;
		missingQuantity: number;
		scope: ActivationInputPlannerScope;
	}) {
		let remainingQuantity = missingQuantity;

		for (const [slotIndex, slot] of scope.save.inventory.slots.entries()) {
			if (remainingQuantity <= 0) break;
			if (!slot || slot.itemId !== input.itemId) continue;

			const reservedQuantity = scope.state.reservedInventorySlotQuantities[slotIndex] ?? 0;
			const availableQuantity = readGameSaveInventorySlotQuantity(slot) - reservedQuantity;
			const quantity = Math.min(remainingQuantity, availableQuantity);
			if (quantity <= 0) continue;

			scope.state.reservedInventorySlotQuantities[slotIndex] = reservedQuantity + quantity;
			scope.state.inputRefs.push({
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
	input,
	scope,
}: {
	input: ActivationInputDemand;
	scope: ActivationInputPlannerScope;
}) {
	const missingQuantity = readMissingActivationInputQuantity({
		input,
		storedInputQuantities: scope.storedInputQuantities,
	});
	if (missingQuantity <= 0) return;

	const afterBoardQuantity = yield* appendBoardActivationInputRefsFx({
		input,
		missingQuantity,
		scope,
	});
	yield* appendInventoryActivationInputRefsFx({
		input,
		missingQuantity: afterBoardQuantity,
		scope,
	});
});

export const planActivationInputRefsFx = Effect.fn("planActivationInputRefsFx")(function* ({
	excludedBoardItemIds = new Set(),
	inputs,
	save,
	storedInputQuantities,
}: planActivationInputRefsFx.Props) {
	const scope: ActivationInputPlannerScope = {
		excludedBoardItemIds,
		inputs,
		save,
		state: createActivationInputPlannerState(),
		storedInputQuantities,
	};

	for (const input of inputs) {
		yield* appendActivationInputRefsFx({
			input,
			scope,
		});
	}

	return scope.state.inputRefs;
});
