import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeProducerChargeStateFromSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

export const removeProducerChargeStateFromSaveFx = Effect.fn("removeProducerChargeStateFromSaveFx")(
	function* ({ itemInstanceId, save }: removeProducerChargeStateFromSaveFx.Props) {
		delete save.producerCharges[itemInstanceId];
	},
);
