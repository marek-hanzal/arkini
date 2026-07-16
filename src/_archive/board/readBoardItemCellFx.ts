import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readBoardItemCellFx {
	export interface Props {
		itemInstanceId?: string;
		save: GameSave;
	}
}

export const readBoardItemCellFx = Effect.fn("readBoardItemCellFx")(function* ({
	itemInstanceId,
	save,
}: readBoardItemCellFx.Props) {
	if (!itemInstanceId) return undefined;

	const item = save.board.items[itemInstanceId];
	if (!item) return undefined;

	return {
		x: item.x,
		y: item.y,
	};
});
