import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";

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

export const readBoardPlacementCapacityFx = Effect.fn("readBoardPlacementCapacityFx")(function* ({
	config,
	itemId,
	save,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
}) {
	const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		itemId,
		save,
	});
	return Math.min(
		yield* readEmptyBoardCellCountFx({
			config,
			save,
		}),
		boardItemMaxCountCapacity,
	);
});

export const readBoardPlacementBlockReasonFx = Effect.fn("readBoardPlacementBlockReasonFx")(
	function* ({ config, itemId, save }: { config: GameConfig; itemId: string; save: GameSave }) {
		return (yield* readBoardItemMaxCountCapacityFx({
			config,
			itemId,
			save,
		})) <= 0
			? "board:max-count"
			: "board:full";
	},
);
