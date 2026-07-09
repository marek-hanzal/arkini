import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace writeActiveEffectToSaveFx {
	export interface Props {
		activeEffect: GameSave["activeEffects"][string];
		save: GameSave;
	}
}

export const writeActiveEffectToSaveFx = Effect.fn("writeActiveEffectToSaveFx")(function* ({
	activeEffect,
	save,
}: writeActiveEffectToSaveFx.Props) {
	save.activeEffects[activeEffect.id] = activeEffect;
});
