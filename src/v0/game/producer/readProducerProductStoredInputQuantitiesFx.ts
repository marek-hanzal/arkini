import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { emptyGameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace readProducerProductStoredInputQuantitiesFx {
	export interface Props {
		save: GameSave;
		producerItemInstanceId: string;
		productId: string;
	}
}

export const readProducerProductStoredInputQuantitiesFx = Effect.fn(
	"readProducerProductStoredInputQuantitiesFx",
)(function* ({
	save,
	producerItemInstanceId,
	productId,
}: readProducerProductStoredInputQuantitiesFx.Props) {
	return (
		save.producerInputs[producerItemInstanceId]?.productInputs[productId]?.items ??
		emptyGameItemQuantityIndex
	);
});
