import { Effect } from "effect";
import { readActivationInputStoredQuantityReady } from "~/activation/readActivationInputStoredQuantityReady";
import type { ProducerStoredInputsReadyProps } from "~/producer/LineStartExecutionTypes";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export const readProducerStoredInputsReadyFx = Effect.fn("readProducerStoredInputsReadyFx")(
	function* ({ inputs, save, itemInstanceId, lineId }: ProducerStoredInputsReadyProps) {
		const storedInputs = yield* readLineStoredInputQuantitiesFx({
			itemInstanceId,
			lineId,
			save,
		});
		return inputs.every((input) =>
			readActivationInputStoredQuantityReady({
				input,
				storedQuantity: readGameItemQuantity({
					itemId: input.itemId,
					quantities: storedInputs,
				}),
			}),
		);
	},
);
