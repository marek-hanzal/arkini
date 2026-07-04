import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeCraftInputStateFromSaveFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const removeCraftInputStateFromSaveFx = Effect.fn("removeCraftInputStateFromSaveFx")(
	function* ({ save, targetItemInstanceId }: removeCraftInputStateFromSaveFx.Props) {
		delete save.craftInputs[targetItemInstanceId];
	},
);
