import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import { readProximityRequirementMatch } from "~/v0/game/requirements/readProximityRequirementMatch";
import type { GameBlocker } from "~/v0/game/blockers/GameBlocker";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";

const defaultBlockerDurationFactor = 1;

const readPassiveBlockerItemQuantity = ({
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

export namespace readGameBlockerDurationMultiplier {
	export interface Props {
		blocker: GameBlocker;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readGameBlockerDurationMultiplier = ({
	blocker,
	save,
	targetItemInstanceId,
}: readGameBlockerDurationMultiplier.Props): number | undefined => {
	if (blocker.type === "passive") {
		const quantity = readPassiveBlockerItemQuantity({
			itemId: blocker.itemId,
			save,
			scope: blocker.scope,
		});
		if (quantity < blocker.quantity) return undefined;

		return Math.max(1, 1 + (blocker.durationFactor ?? defaultBlockerDurationFactor));
	}

	const match = readProximityRequirementMatch({
		itemIds: blocker.itemIds,
		save,
		targetItemInstanceId,
	});
	if (!match || match.distance > blocker.distance) return undefined;

	const proximityStrength = blocker.distance - match.distance + 1;
	return Math.max(
		1,
		1 + proximityStrength * (blocker.durationFactor ?? defaultBlockerDurationFactor),
	);
};

export namespace readGameBlockersDurationMultiplier {
	export interface Props {
		blockers: readonly GameBlocker[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readGameBlockersDurationMultiplier = ({
	blockers,
	save,
	targetItemInstanceId,
}: readGameBlockersDurationMultiplier.Props): number => {
	const multipliers = blockers.flatMap((blocker) => {
		const multiplier = readGameBlockerDurationMultiplier({
			blocker,
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
