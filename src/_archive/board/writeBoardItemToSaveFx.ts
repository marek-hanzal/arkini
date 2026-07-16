import { Effect } from "effect";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export namespace writeBoardItemToSaveFx {
	export interface Props {
		item: GameSaveBoardItem;
		save: GameSave;
	}
}

export const writeBoardItemToSaveFx = Effect.fn("writeBoardItemToSaveFx")(function* ({
	item,
	save,
}: writeBoardItemToSaveFx.Props) {
	save.board.items[item.id] = item;
});
