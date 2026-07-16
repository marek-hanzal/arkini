import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readOrCreateCraftInputStateFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readOrCreateCraftInputStateFx = Effect.fn("readOrCreateCraftInputStateFx")(function* ({
	save,
	targetItemInstanceId,
}: readOrCreateCraftInputStateFx.Props) {
	return (save.craftInputs[targetItemInstanceId] ??= {
		items: {},
	});
});
