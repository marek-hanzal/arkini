import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProximityRequirementsDurationMultiplier } from "~/v0/game/requirements/readProximityRequirementsDurationMultiplier";

export namespace readCraftRecipeDurationMs {
	export interface Props {
		recipe: GameConfig["craftRecipes"][string];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readCraftRecipeDurationMs = ({
	recipe,
	save,
	targetItemInstanceId,
}: readCraftRecipeDurationMs.Props) =>
	Math.max(
		0,
		Math.ceil(
			recipe.durationMs *
				readProximityRequirementsDurationMultiplier({
					requirements: recipe.requirements,
					save,
					targetItemInstanceId,
				}),
		),
	);
