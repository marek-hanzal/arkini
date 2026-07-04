import { Effect } from "effect";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeBoardItemFromSaveFx {
	export interface Props {
		itemInstanceId: string;
		runtimeState: "remove" | "preserve";
		save: GameSave;
	}
}

export const removeBoardItemFromSaveFx = Effect.fn("removeBoardItemFromSaveFx")(function* ({
	itemInstanceId,
	runtimeState,
	save,
}: removeBoardItemFromSaveFx.Props) {
	delete save.board.items[itemInstanceId];
	if (runtimeState === "remove") {
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId,
			save,
		});
	}
});
