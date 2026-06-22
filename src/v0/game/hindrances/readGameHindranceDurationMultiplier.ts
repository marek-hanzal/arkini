import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import { readProximityRequirementMatches } from "~/v0/game/requirements/readProximityRequirementMatch";
import type { GameHindrance } from "~/v0/game/hindrances/GameHindrance";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";

const defaultHindranceDurationFactor = 1;

export const readPassiveHindranceItemQuantity = ({
	itemId,
	save,
	scope,
}: {
	itemId: string;
	save: GameSave;
	scope: GamePassiveRequirementScope;
}) => {
	let quantity = 0;

	if (scope === "board" || scope === "board_or_inventory") {
		quantity += Object.values(save.board.items).filter((item) => item.itemId === itemId).length;
	}

	if (scope === "inventory" || scope === "board_or_inventory") {
		quantity += save.inventory.slots.reduce(
			(total, slot) =>
				total + (slot?.itemId === itemId ? readGameSaveInventorySlotQuantity(slot) : 0),
			0,
		);
	}

	return quantity;
};

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
		const quantity = readPassiveHindranceItemQuantity({
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
