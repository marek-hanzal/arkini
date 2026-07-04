import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace writeItemCapacityStateToSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
		state: GameSave["itemCapacities"][string];
	}
}

export const writeItemCapacityStateToSaveFx = Effect.fn("writeItemCapacityStateToSaveFx")(
	function* ({ itemInstanceId, save, state }: writeItemCapacityStateToSaveFx.Props) {
		save.itemCapacities[itemInstanceId] = state;
	},
);
