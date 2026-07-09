import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { removeCraftInputStateFromSaveFx } from "~/craft/removeCraftInputStateFromSaveFx";

export namespace pruneEmptyCraftInputStateFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const pruneEmptyCraftInputStateFx = Effect.fn("pruneEmptyCraftInputStateFx")(function* ({
	save,
	targetItemInstanceId,
}: pruneEmptyCraftInputStateFx.Props) {
	const craftInputState = save.craftInputs[targetItemInstanceId];
	if (!craftInputState || Object.keys(craftInputState.items).length > 0) return;

	yield* removeCraftInputStateFromSaveFx({
		save,
		targetItemInstanceId,
	});
});
