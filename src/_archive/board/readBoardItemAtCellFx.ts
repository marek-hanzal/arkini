import { Effect } from "effect";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export namespace readBoardItemAtCellFx {
	export interface Props {
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		save: GameSave;
		x: number;
		y: number;
	}
}

export const readBoardItemAtCellFx = Effect.fn("readBoardItemAtCellFx")(function* ({
	ignoredBoardItemInstanceIds = new Set(),
	save,
	x,
	y,
}: readBoardItemAtCellFx.Props): Generator<never, GameSaveBoardItem | undefined> {
	return Object.values(save.board.items).find(
		(item) => !ignoredBoardItemInstanceIds.has(item.id) && item.x === x && item.y === y,
	);
});
