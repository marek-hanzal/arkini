import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

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
	return save.craftInputs[targetItemInstanceId]?.items ?? emptyGameItemQuantityIndex;
});
