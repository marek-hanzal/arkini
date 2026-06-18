import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readCraftInputQuantitiesFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readCraftInputQuantitiesFx = Effect.fn("readCraftInputQuantitiesFx")(function* ({
	save,
	targetItemInstanceId,
}: readCraftInputQuantitiesFx.Props) {
	return new Map(Object.entries(save.craftInputs[targetItemInstanceId]?.items ?? {}));
});
