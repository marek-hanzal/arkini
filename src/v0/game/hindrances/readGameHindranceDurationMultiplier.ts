import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import { readProximityRequirementMatch } from "~/v0/game/requirements/readProximityRequirementMatch";
import type { GameHindrance } from "~/v0/game/hindrances/GameHindrance";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";

const defaultHindranceDurationFactor = 1;

const readPassiveHindranceItemQuantity = ({
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
	if (hindrance.type === "passive") {
		const quantity = readPassiveHindranceItemQuantity({
			itemId: hindrance.itemId,
			save,
			scope: hindrance.scope,
		});
		if (quantity < hindrance.quantity) return undefined;

		return Math.max(1, 1 + (hindrance.durationFactor ?? defaultHindranceDurationFactor));
	}

	const match = readProximityRequirementMatch({
		itemIds: hindrance.itemIds,
		save,
		targetItemInstanceId,
	});
	if (!match || match.distance > hindrance.distance) return undefined;

	const proximityStrength = hindrance.distance - match.distance + 1;
	return Math.max(
		1,
		1 + proximityStrength * (hindrance.durationFactor ?? defaultHindranceDurationFactor),
	);
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
}: readGameHindrancesDurationMultiplier.Props): number => {
	const multipliers = hindrances.flatMap((hindrance) => {
		const multiplier = readGameHindranceDurationMultiplier({
			hindrance,
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

	return Math.max(...multipliers);
};
