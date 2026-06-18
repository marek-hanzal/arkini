import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readStoredRequirementQuantitiesFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readStoredRequirementQuantitiesFx = Effect.fn("readStoredRequirementQuantitiesFx")(
	function* ({ save, targetItemInstanceId }: readStoredRequirementQuantitiesFx.Props) {
		return new Map(Object.entries(save.storedRequirements[targetItemInstanceId]?.items ?? {}));
	},
);
