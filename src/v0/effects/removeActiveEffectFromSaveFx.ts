import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeActiveEffectFromSaveFx {
	export interface Props {
		activeEffectId: string;
		save: GameSave;
	}
}

export const removeActiveEffectFromSaveFx = Effect.fn("removeActiveEffectFromSaveFx")(function* ({
	activeEffectId,
	save,
}: removeActiveEffectFromSaveFx.Props) {
	delete save.activeEffects[activeEffectId];
});
