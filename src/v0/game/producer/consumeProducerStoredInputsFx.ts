import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import { readActivationInputMode } from "~/v0/game/activation/readActivationInputMode";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace consumeProducerStoredInputsFx {
	export interface Props {
		nextSave: GameSave;
		itemInstanceId: string;
		lineId: string;
		inputs: readonly GameActivationInput[];
	}
}

export const consumeProducerStoredInputsFx = Effect.fn("consumeProducerStoredInputsFx")(function* ({
	nextSave,
	itemInstanceId,
	lineId,
	inputs,
}: consumeProducerStoredInputsFx.Props) {
	const producerInputState = nextSave.producerInputs[itemInstanceId];
	const lineInputState = producerInputState?.lineInputs[lineId];
	if (!producerInputState || !lineInputState) return;

	for (const input of inputs) {
		if (!input.consume) continue;

		const previousQuantity = lineInputState.items[input.itemId] ?? 0;
		const consumedQuantity =
			readActivationInputMode(input) === "upTo"
				? Math.min(previousQuantity, input.quantity)
				: input.quantity;
		const nextQuantity = previousQuantity - consumedQuantity;
		if (nextQuantity > 0) {
			lineInputState.items[input.itemId] = nextQuantity;
		} else {
			delete lineInputState.items[input.itemId];
		}
	}

	if (Object.keys(lineInputState.items).length === 0) {
		delete producerInputState.lineInputs[lineId];
	}
	if (Object.keys(producerInputState.lineInputs).length === 0) {
		delete nextSave.producerInputs[itemInstanceId];
	}
});
