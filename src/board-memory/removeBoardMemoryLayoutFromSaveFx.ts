import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeBoardMemoryLayoutFromSaveFx {
	export interface Props {
		boardItemId: string;
		save: GameSave;
	}
}

export const removeBoardMemoryLayoutFromSaveFx = Effect.fn("removeBoardMemoryLayoutFromSaveFx")(
	function* ({ boardItemId, save }: removeBoardMemoryLayoutFromSaveFx.Props) {
		delete save.boardMemoryLayouts[boardItemId];
	},
);
