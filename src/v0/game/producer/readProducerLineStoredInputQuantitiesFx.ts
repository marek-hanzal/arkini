import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace readProducerLineStoredInputQuantitiesFx {
	export interface Props {
		save: GameSave;
		producerItemInstanceId: string;
		lineId: string;
	}
}

export const readProducerLineStoredInputQuantitiesFx = Effect.fn(
	"readProducerLineStoredInputQuantitiesFx",
)(function* ({
	save,
	producerItemInstanceId,
	lineId,
}: readProducerLineStoredInputQuantitiesFx.Props) {
	return (
		save.producerInputs[producerItemInstanceId]?.lineInputs[lineId]?.items ??
		emptyGameItemQuantityIndex
	);
});
