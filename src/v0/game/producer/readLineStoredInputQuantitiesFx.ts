import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace readLineStoredInputQuantitiesFx {
	export interface Props {
		save: GameSave;
		itemInstanceId: string;
		lineId: string;
	}
}

export const readLineStoredInputQuantitiesFx = Effect.fn("readLineStoredInputQuantitiesFx")(
	function* ({ save, itemInstanceId, lineId }: readLineStoredInputQuantitiesFx.Props) {
		return (
			save.producerInputs[itemInstanceId]?.lineInputs[lineId]?.items ??
			emptyGameItemQuantityIndex
		);
	},
);
