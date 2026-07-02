import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { readGameCheatEffectiveDurationMs } from "~/cheat/GameCheatSpeedMode";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readCraftRecipeDurationMs {
	export interface Props {
		recipe: GameCraftRecipeDefinition;
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
