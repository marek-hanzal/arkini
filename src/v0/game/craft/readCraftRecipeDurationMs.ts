import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace readCraftRecipeDurationMs {
	export interface Props {
		recipe: GameConfig["craftRecipes"][string];
	}
}

export const readCraftRecipeDurationMs = ({ recipe }: readCraftRecipeDurationMs.Props) =>
	Math.max(0, recipe.durationMs);
