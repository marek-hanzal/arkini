import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace readStoredRequirementQuantitiesFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readStoredRequirementQuantitiesFx = Effect.fn("readStoredRequirementQuantitiesFx")(
	function* ({ save, targetItemInstanceId }: readStoredRequirementQuantitiesFx.Props) {
		return save.storedRequirements[targetItemInstanceId]?.items ?? emptyGameItemQuantityIndex;
	},
);
