import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace writeProducerChargeStateToSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
		state: GameSave["producerCharges"][string];
	}
}

export const writeProducerChargeStateToSaveFx = Effect.fn("writeProducerChargeStateToSaveFx")(
	function* ({ itemInstanceId, save, state }: writeProducerChargeStateToSaveFx.Props) {
		save.producerCharges[itemInstanceId] = state;
	},
);
