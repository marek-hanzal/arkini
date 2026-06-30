import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import { readActivationInputMode } from "~/v0/game/activation/readActivationInputMode";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace consumeProducerStoredInputsFx {
	export interface Props {
		nextSave: GameSave;
		producerItemInstanceId: string;
		productId: string;
		inputs: readonly GameActivationInput[];
	}
}

export const consumeProducerStoredInputsFx = Effect.fn("consumeProducerStoredInputsFx")(function* ({
	nextSave,
	producerItemInstanceId,
	productId,
	inputs,
}: consumeProducerStoredInputsFx.Props) {
	const producerInputState = nextSave.producerInputs[producerItemInstanceId];
	const productInputState = producerInputState?.productInputs[productId];
	if (!producerInputState || !productInputState) return;

	for (const input of inputs) {
		if (!input.consume) continue;

		const previousQuantity = productInputState.items[input.itemId] ?? 0;
		const consumedQuantity =
			readActivationInputMode(input) === "upTo"
				? Math.min(previousQuantity, input.quantity)
				: input.quantity;
		const nextQuantity = previousQuantity - consumedQuantity;
		if (nextQuantity > 0) {
			productInputState.items[input.itemId] = nextQuantity;
		} else {
			delete productInputState.items[input.itemId];
		}
	}

	if (Object.keys(productInputState.items).length === 0) {
		delete producerInputState.productInputs[productId];
	}
	if (Object.keys(producerInputState.productInputs).length === 0) {
		delete nextSave.producerInputs[producerItemInstanceId];
	}
});
