import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/quantity/GameItemQuantityIndex";

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
