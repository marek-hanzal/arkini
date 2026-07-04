import { Effect } from "effect";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import { readActivationInputMode } from "~/activation/readActivationInputMode";
import { writeStoredActivationInputQuantityFx } from "~/activation/writeStoredActivationInputQuantityFx";
import { pruneEmptyProducerInputStateFx } from "~/producer/pruneEmptyProducerInputStateFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
		yield* writeStoredActivationInputQuantityFx({
			itemId: input.itemId,
			nextQuantity,
			state: lineInputState,
		});
	}

	yield* pruneEmptyProducerInputStateFx({
		itemInstanceId,
		lineId,
		save: nextSave,
	});
});
