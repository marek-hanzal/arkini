import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace cloneGameSaveFx {
	export interface Props {
		save: GameSave;
	}
}

export const cloneGameSaveFx = Effect.fn("cloneGameSaveFx")(function* ({
	save,
}: cloneGameSaveFx.Props) {
	return structuredClone(save) as GameSave;
});
