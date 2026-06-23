import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readStashInputQuantitiesFx {
	export interface Props {
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashInputQuantitiesFx = Effect.fn("readStashInputQuantitiesFx")(
	function* ({ save, stashItemInstanceId }: readStashInputQuantitiesFx.Props) {
		return new Map(Object.entries(save.stashInputs[stashItemInstanceId]?.items ?? {}));
	},
);
