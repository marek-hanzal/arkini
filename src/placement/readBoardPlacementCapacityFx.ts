import { Effect } from "effect";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { readBoardItemStackCapacity } from "~/board/readBoardItemStackCapacity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { planBoardStackItemsFx } from "~/placement/planBoardStackItemsFx";

const readEmptyBoardCellCountFx = Effect.fn("readEmptyBoardCellCountFx")(function* ({
	config,
	save,
}: {
	config: GameConfig;
	save: GameSave;
}) {
	const boardCellCount = config.game.board.width * config.game.board.height;
	return Math.max(0, boardCellCount - Object.keys(save.board.items).length);
});

const readExistingBoardStackCapacityFx = Effect.fn("readExistingBoardStackCapacityFx")(function* ({
	config,
	itemId,
	save,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
}) {
	const stackTargets = yield* planBoardStackItemsFx({
		config,
		itemId,
		save,
	});
	return stackTargets.reduce(
		(capacity, item) =>
			capacity +
			readBoardItemStackCapacity({
				config,
				item,
			}),
		0,
	);
});

export const readBoardPlacementCapacityFx = Effect.fn("readBoardPlacementCapacityFx")(function* ({
	config,
	itemId,
	save,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
}) {
	const itemDefinition = config.items[itemId];
	if (!itemDefinition) return 0;

	const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		itemId,
		save,
	});
	const existingStackCapacity =
		boardItemMaxCountCapacity > 0
			? yield* readExistingBoardStackCapacityFx({
					config,
					itemId,
					save,
				})
			: 0;
	const emptyCellStackCapacity =
		(yield* readEmptyBoardCellCountFx({
			config,
			save,
		})) * itemDefinition.maxStackSize;
	const newBoardItemCapacity = Math.min(emptyCellStackCapacity, boardItemMaxCountCapacity);
	return existingStackCapacity + newBoardItemCapacity;
});

export const readBoardPlacementBlockReasonFx = Effect.fn("readBoardPlacementBlockReasonFx")(
	function* ({ config, itemId, save }: { config: GameConfig; itemId: string; save: GameSave }) {
		const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
			config,
			itemId,
			save,
		});
		if (boardItemMaxCountCapacity <= 0) return "board:max-count";

		return "board:full";
	},
);
