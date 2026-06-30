import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/v0/game/activation/planActivationInputRefsFx";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";

export namespace planProducerProductAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		producerItemInstanceId: string;
		productId: string;
		save: GameSave;
	}
}

export const planProducerProductAutoFillInputRefsFx = Effect.fn(
	"planProducerProductAutoFillInputRefsFx",
)(function* ({
	inputs,
	producerItemInstanceId,
	productId,
	save,
}: planProducerProductAutoFillInputRefsFx.Props) {
	const storedInputs = yield* readProducerProductStoredInputQuantitiesFx({
		producerItemInstanceId,
		productId,
		save,
	});

	return yield* planActivationInputRefsFx({
		excludedBoardItemIds: new Set([
			producerItemInstanceId,
		]),
		inputs,
		save,
		storedInputQuantities: storedInputs,
	});
});
