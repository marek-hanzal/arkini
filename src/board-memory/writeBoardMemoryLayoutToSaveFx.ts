import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace writeBoardMemoryLayoutToSaveFx {
	export interface Props {
		boardItemId: string;
		layout: GameSave["boardMemoryLayouts"][string];
		save: GameSave;
	}
}

export const writeBoardMemoryLayoutToSaveFx = Effect.fn("writeBoardMemoryLayoutToSaveFx")(
	function* ({ boardItemId, layout, save }: writeBoardMemoryLayoutToSaveFx.Props) {
		save.boardMemoryLayouts[boardItemId] = layout;
	},
);
