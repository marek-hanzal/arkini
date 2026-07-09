import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace pruneEmptyProducerInputStateFx {
	export interface Props {
		itemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const pruneEmptyProducerInputStateFx = Effect.fn("pruneEmptyProducerInputStateFx")(
	function* ({ itemInstanceId, lineId, save }: pruneEmptyProducerInputStateFx.Props) {
		const producerInputState = save.producerInputs[itemInstanceId];
		const lineInputState = producerInputState?.lineInputs[lineId];
		if (!producerInputState || !lineInputState) return;

		if (Object.keys(lineInputState.items).length === 0) {
			delete producerInputState.lineInputs[lineId];
		}
		if (Object.keys(producerInputState.lineInputs).length === 0) {
			delete save.producerInputs[itemInstanceId];
		}
	},
);
