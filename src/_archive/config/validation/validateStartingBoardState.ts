import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import type { StartingBoardEntry } from "~/config/validation/StartingStateValidationTypes";

export const validateStartingBoardState = ({
	ctx,
	hasItem,
	value,
}: {
	ctx: z.RefinementCtx;
	hasItem: (itemId: string) => boolean;
	value: GameConfig;
}) => {
	const usedStartingBoardCells = new Set<string>();
	const startingBoardItemCountByItemId = new Map<string, number>();
	for (const [index, entry] of value.startingState.board.entries()) {
		validateStartingBoardEntryItem({
			ctx,
			entry,
			hasItem,
			index,
			value,
		});
		validateStartingBoardEntryPosition({
			ctx,
			entry,
			index,
			value,
		});
		startingBoardItemCountByItemId.set(
			entry.itemId,
			(startingBoardItemCountByItemId.get(entry.itemId) ?? 0) + 1,
		);
		recordStartingBoardCellUsage({
			ctx,
			entry,
			index,
			usedStartingBoardCells,
		});
	}

	validateStartingBoardItemMaxCounts({
		ctx,
		startingBoardItemCountByItemId,
		value,
	});
};

const validateStartingBoardEntryItem = ({
	ctx,
	entry,
	hasItem,
	index,
	value,
}: {
	ctx: z.RefinementCtx;
	entry: StartingBoardEntry;
	hasItem: (itemId: string) => boolean;
	index: number;
	value: GameConfig;
}) => {
	if (!hasItem(entry.itemId)) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"itemId",
			],
			`Missing item "${entry.itemId}".`,
		);
		return;
	}
	if (value.items[entry.itemId]?.storage === "inventory") {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"itemId",
			],
			`Item "${entry.itemId}" storage policy forbids board placement.`,
		);
	}
};

const validateStartingBoardEntryPosition = ({
	ctx,
	entry,
	index,
	value,
}: {
	ctx: z.RefinementCtx;
	entry: StartingBoardEntry;
	index: number;
	value: GameConfig;
}) => {
	if (entry.x >= value.game.board.width) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"x",
			],
			`x must be < board width (${value.game.board.width}).`,
		);
	}
	if (entry.y >= value.game.board.height) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
				"y",
			],
			`y must be < board height (${value.game.board.height}).`,
		);
	}
};

const recordStartingBoardCellUsage = ({
	ctx,
	entry,
	index,
	usedStartingBoardCells,
}: {
	ctx: z.RefinementCtx;
	entry: StartingBoardEntry;
	index: number;
	usedStartingBoardCells: Set<string>;
}) => {
	const cellKey = `${entry.x}:${entry.y}`;
	if (usedStartingBoardCells.has(cellKey)) {
		addIssue(
			ctx,
			[
				"startingState",
				"board",
				index,
			],
			`Duplicate starting board cell (${entry.x}, ${entry.y}).`,
		);
	}
	usedStartingBoardCells.add(cellKey);
};

const validateStartingBoardItemMaxCounts = ({
	ctx,
	startingBoardItemCountByItemId,
	value,
}: {
	ctx: z.RefinementCtx;
	startingBoardItemCountByItemId: ReadonlyMap<string, number>;
	value: GameConfig;
}) => {
	for (const [itemId, quantity] of startingBoardItemCountByItemId) {
		const maxCount = value.items[itemId]?.maxCount;
		if (maxCount === undefined || quantity <= maxCount) continue;
		addIssue(
			ctx,
			[
				"startingState",
				"board",
			],
			`Starting board has ${quantity} item(s) of "${itemId}" but maxCount is ${maxCount}.`,
		);
	}
};
