import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace writeProducerLineStateToSaveFx {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
		state: GameSave["lines"][string];
	}
}

export const writeProducerLineStateToSaveFx = Effect.fn("writeProducerLineStateToSaveFx")(
	function* ({ itemInstanceId, save, state }: writeProducerLineStateToSaveFx.Props) {
		save.lines[itemInstanceId] = state;
	},
);
