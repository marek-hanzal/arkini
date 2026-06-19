import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import { readProximityRequirementMatch } from "~/v0/game/requirements/readProximityRequirementMatch";

export namespace readProximityRequirementDurationMultiplier {
	export interface Props {
		requirement: Extract<
			GameRequirement,
			{
				type: "proximity";
			}
		>;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readProximityRequirementDurationMultiplier = ({
	requirement,
	save,
	targetItemInstanceId,
}: readProximityRequirementDurationMultiplier.Props): number | undefined => {
	const match = readProximityRequirementMatch({
		itemIds: requirement.itemIds,
		save,
		targetItemInstanceId,
	});
	if (!match || match.distance > requirement.distance) return undefined;

	return Math.max(1, match.distance * (requirement.durationFactor ?? 1));
};

export namespace readProximityRequirementsDurationMultiplier {
	export interface Props {
		requirements: readonly GameRequirement[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readProximityRequirementsDurationMultiplier = ({
	requirements,
	save,
	targetItemInstanceId,
}: readProximityRequirementsDurationMultiplier.Props): number => {
	const multipliers = requirements.flatMap((requirement) => {
		if (requirement.type !== "proximity") return [];

		const multiplier = readProximityRequirementDurationMultiplier({
			requirement,
			save,
			targetItemInstanceId,
		});

		return multiplier === undefined
			? []
			: [
					multiplier,
				];
	});

	if (multipliers.length === 0) return 1;

	return multipliers.reduce((sum, multiplier) => sum + multiplier, 0) / multipliers.length;
};
