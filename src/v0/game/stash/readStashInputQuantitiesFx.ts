import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace readStashInputQuantitiesFx {
	export interface Props {
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashInputQuantitiesFx = Effect.fn("readStashInputQuantitiesFx")(function* ({
	save,
	stashItemInstanceId,
}: readStashInputQuantitiesFx.Props) {
	return save.stashInputs[stashItemInstanceId]?.items ?? emptyGameItemQuantityIndex;
});
