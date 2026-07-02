import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/v0/game/activation/planActivationInputRefsFx";
import { readProducerLineStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerLineStoredInputQuantitiesFx";

export namespace planProducerLineAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		producerItemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const planProducerLineAutoFillInputRefsFx = Effect.fn("planProducerLineAutoFillInputRefsFx")(
	function* ({
		inputs,
		producerItemInstanceId,
		lineId,
		save,
	}: planProducerLineAutoFillInputRefsFx.Props) {
		const storedInputs = yield* readProducerLineStoredInputQuantitiesFx({
			producerItemInstanceId,
			lineId,
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
	},
);
