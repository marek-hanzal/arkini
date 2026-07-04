import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeProducerLineStateFromSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
	}
}

export const removeProducerLineStateFromSaveFx = Effect.fn("removeProducerLineStateFromSaveFx")(
	function* ({ itemInstanceId, save }: removeProducerLineStateFromSaveFx.Props) {
		delete save.lines[itemInstanceId];
	},
);
