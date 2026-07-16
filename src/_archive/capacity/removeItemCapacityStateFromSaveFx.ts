import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeItemCapacityStateFromSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

export const removeItemCapacityStateFromSaveFx = Effect.fn("removeItemCapacityStateFromSaveFx")(
	function* ({ itemInstanceId, save }: removeItemCapacityStateFromSaveFx.Props) {
		delete save.itemCapacities[itemInstanceId];
	},
);
