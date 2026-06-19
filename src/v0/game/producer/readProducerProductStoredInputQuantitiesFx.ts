import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
	return new Map(
		Object.entries(
			save.producerInputs[producerItemInstanceId]?.productInputs[productId]?.items ?? {},
		),
	);
});
