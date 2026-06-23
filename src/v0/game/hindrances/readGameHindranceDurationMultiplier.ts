import { readProximityRequirementMatches } from "~/v0/game/requirements/readProximityRequirementMatch";
import type { GameHindrance } from "~/v0/game/hindrances/GameHindrance";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveItemQuantityByScope } from "~/v0/game/requirements/readGameSaveItemQuantityByScope";

const defaultHindranceDurationFactor = 1;

const readHindranceDurationFactor = (hindrance: GameHindrance) =>
	hindrance.durationFactor ?? defaultHindranceDurationFactor;

const multiply = (values: readonly number[]) =>
	values.reduce((total, value) => total * Math.max(1, value), 1);

export namespace readGameHindranceDurationMultipliers {
	export interface Props {
		hindrance: GameHindrance;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readGameHindranceDurationMultipliers = ({
	hindrance,
	save,
	targetItemInstanceId,
}: readGameHindranceDurationMultipliers.Props): number[] => {
	if (hindrance.type === "passive") {
		const quantity = readGameSaveItemQuantityByScope({
			itemId: hindrance.itemId,
			save,
			scope: hindrance.scope,
		});
		const activeStacks = Math.floor(quantity / hindrance.quantity);
		if (activeStacks <= 0) return [];

		return Array.from(
			{
				length: activeStacks,
			},
			() => Math.max(1, 1 + readHindranceDurationFactor(hindrance)),
		);
	}

	return readProximityRequirementMatches({
		itemIds: hindrance.itemIds,
		save,
		targetItemInstanceId,
	})
		.filter((match) => match.distance <= hindrance.distance)
		.map((match) => {
			const proximityStrength = hindrance.distance - match.distance + 1;
			return Math.max(1, 1 + proximityStrength * readHindranceDurationFactor(hindrance));
		});
};

export namespace readGameHindranceDurationMultiplier {
	export interface Props {
		hindrance: GameHindrance;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readGameHindranceDurationMultiplier = ({
	hindrance,
	save,
	targetItemInstanceId,
}: readGameHindranceDurationMultiplier.Props): number | undefined => {
	const multiplier = multiply(
		readGameHindranceDurationMultipliers({
			hindrance,
			save,
			targetItemInstanceId,
		}),
	);

	return multiplier > 1 ? multiplier : undefined;
};

export namespace readGameHindrancesDurationMultiplier {
	export interface Props {
		hindrances: readonly GameHindrance[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readGameHindrancesDurationMultiplier = ({
	hindrances,
	save,
	targetItemInstanceId,
}: readGameHindrancesDurationMultiplier.Props): number =>
	multiply(
		hindrances.flatMap((hindrance) =>
			readGameHindranceDurationMultipliers({
				hindrance,
				save,
				targetItemInstanceId,
			}),
		),
	);
