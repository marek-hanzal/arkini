import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace writeCraftInputStateToSaveFx {
	export interface Props {
		save: GameSave;
		state: GameSave["craftInputs"][string];
		targetItemInstanceId: string;
	}
}

export const writeCraftInputStateToSaveFx = Effect.fn("writeCraftInputStateToSaveFx")(function* ({
	save,
	state,
	targetItemInstanceId,
}: writeCraftInputStateToSaveFx.Props) {
	save.craftInputs[targetItemInstanceId] = state;
});
