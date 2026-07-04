import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeProducerInputStateFromSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

export const removeProducerInputStateFromSaveFx = Effect.fn("removeProducerInputStateFromSaveFx")(
	function* ({ itemInstanceId, save }: removeProducerInputStateFromSaveFx.Props) {
		delete save.producerInputs[itemInstanceId];
	},
);
