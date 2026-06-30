import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readGameCheatEffectiveDurationMs } from "~/v0/game/cheat/GameCheatSpeedMode";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readCraftRecipeDurationMs {
	export interface Props {
		recipe: GameConfig["craftRecipes"][string];
		save?: GameSave;
	}
}

export const readCraftRecipeDurationMs = ({ recipe, save }: readCraftRecipeDurationMs.Props) => {
	const durationMs = Math.max(0, recipe.durationMs);
	return save
		? readGameCheatEffectiveDurationMs({
				durationMs,
				save,
			})
		: durationMs;
};
