import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/quantity/GameItemQuantityIndex";

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
