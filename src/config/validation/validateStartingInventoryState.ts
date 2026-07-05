import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import type { StartingInventoryEntry } from "~/config/validation/StartingStateValidationTypes";

export const validateStartingInventoryState = ({
	ctx,
	hasItem,
	value,
}: {
	ctx: z.RefinementCtx;
	hasItem: (itemId: string) => boolean;
	value: GameConfig;
}) => {
	if (value.startingState.inventory.length > value.game.inventory.slots) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
			],
			`Starting inventory has ${value.startingState.inventory.length} stacks but only ${value.game.inventory.slots} slots are configured.`,
		);
	}

	for (const [index, entry] of value.startingState.inventory.entries()) {
		validateStartingInventoryEntry({
			ctx,
			entry,
			hasItem,
			index,
			value,
		});
	}
};

const validateStartingInventoryEntry = ({
	ctx,
	entry,
	hasItem,
	index,
	value,
}: {
	ctx: z.RefinementCtx;
	entry: StartingInventoryEntry;
	hasItem: (itemId: string) => boolean;
	index: number;
	value: GameConfig;
}) => {
	if (!hasItem(entry.itemId)) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			`Missing item "${entry.itemId}".`,
		);
		return;
	}
	const item = value.items[entry.itemId];
	if (item?.storage === "board") {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			`Item "${entry.itemId}" storage policy forbids inventory placement.`,
		);
	}
	if (item && entry.quantity > item.maxStackSize) {
		addIssue(
			ctx,
			[
				"startingState",
				"inventory",
				index,
				"quantity",
			],
			`Quantity must be <= item maxStackSize (${item.maxStackSize}).`,
		);
	}
};
