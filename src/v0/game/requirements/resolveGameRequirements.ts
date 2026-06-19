import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";

export namespace resolveGameRequirements {
	export interface Props {
		config: GameConfig;
		requirementIds: readonly string[];
	}
}

export const resolveGameRequirements = ({
	config,
	requirementIds,
}: resolveGameRequirements.Props): GameRequirement[] =>
	requirementIds.flatMap((requirementId) => {
		const requirement = config.requirements[requirementId];
		return requirement
			? [
					requirement,
				]
			: [];
	});
