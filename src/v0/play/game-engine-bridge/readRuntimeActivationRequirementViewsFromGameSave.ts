import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readProximityRequirementDurationMultiplier } from "~/v0/game/requirements/readProximityRequirementsDurationMultiplier";
import { readGameSaveItemQuantityByScope } from "~/v0/game/requirements/readGameSaveItemQuantityByScope";
import { readProximityRequirementMatch } from "~/v0/game/requirements/readProximityRequirementMatch";

type RuntimeActivationRequirement =
	| {
			capacity: number;
			itemId: string;
			quantity: number;
			type: "stored";
	  }
	| {
			itemId: string;
			quantity: number;
			scope: "board" | "inventory" | "board_or_inventory";
			type: "passive";
	  }
	| {
			distance: number;
			durationFactor?: number;
			itemIds: string[];
			type: "proximity";
	  };

namespace readRuntimeStoredRequirementQuantityFromGameSave {
	export interface Props {
		itemId: string;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const readRuntimeStoredRequirementQuantityFromGameSave = ({
	itemId,
	save,
	targetItemInstanceId,
}: readRuntimeStoredRequirementQuantityFromGameSave.Props) =>
	save.storedRequirements[targetItemInstanceId]?.items[itemId] ?? 0;

export namespace readRuntimeActivationRequirementViewsFromGameSave {
	export interface Props {
		requirements: readonly RuntimeActivationRequirement[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const readRuntimeStoredRequirementViewFromGameSave = ({
	requirement,
	save,
	targetItemInstanceId,
}: {
	requirement: Extract<
		RuntimeActivationRequirement,
		{
			type: "stored";
		}
	>;
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationRequirementView => ({
	capacity: requirement.capacity,
	itemId: requirement.itemId as ItemId,
	quantity: requirement.quantity,
	stored: readRuntimeStoredRequirementQuantityFromGameSave({
		itemId: requirement.itemId as ItemId,
		save,
		targetItemInstanceId,
	}),
	type: "stored",
});

const readRuntimePassiveRequirementViewFromGameSave = ({
	requirement,
	save,
}: {
	requirement: Extract<
		RuntimeActivationRequirement,
		{
			type: "passive";
		}
	>;
	save: GameSave;
}): ActivationRequirementView => ({
	capacity: requirement.quantity,
	itemId: requirement.itemId as ItemId,
	quantity: requirement.quantity,
	stored: readGameSaveItemQuantityByScope({
		itemId: requirement.itemId,
		save,
		scope: requirement.scope,
	}),
	type: "passive",
});

const readRuntimeProximityRequirementViewFromGameSave = ({
	requirement,
	save,
	targetItemInstanceId,
}: {
	requirement: Extract<
		RuntimeActivationRequirement,
		{
			type: "proximity";
		}
	>;
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationRequirementView => {
	const match = readProximityRequirementMatch({
		itemIds: requirement.itemIds,
		save,
		targetItemInstanceId,
	});
	const satisfied = match ? match.distance <= requirement.distance : false;

	return {
		distance: requirement.distance,
		durationFactor: requirement.durationFactor ?? 1,
		durationMultiplier: satisfied
			? readProximityRequirementDurationMultiplier({
					requirement,
					save,
					targetItemInstanceId,
				})
			: undefined,
		itemIds: requirement.itemIds as ItemId[],
		matchedDistance: match?.distance,
		matchedItemId: match?.item.itemId as ItemId | undefined,
		satisfied,
		type: "proximity",
	};
};

export const readRuntimeActivationRequirementViewsFromGameSave = ({
	requirements,
	save,
	targetItemInstanceId,
}: readRuntimeActivationRequirementViewsFromGameSave.Props): ActivationRequirementView[] =>
	requirements.map((requirement) => {
		if (requirement.type === "stored") {
			return readRuntimeStoredRequirementViewFromGameSave({
				requirement,
				save,
				targetItemInstanceId,
			});
		}

		if (requirement.type === "proximity") {
			return readRuntimeProximityRequirementViewFromGameSave({
				requirement,
				save,
				targetItemInstanceId,
			});
		}

		return readRuntimePassiveRequirementViewFromGameSave({
			requirement,
			save,
		});
	});

export namespace readRuntimeMissingRequirementItemIdsFromGameSave {
	export interface Props {
		requirements: readonly RuntimeActivationRequirement[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readRuntimeMissingRequirementItemIdsFromGameSave = ({
	requirements,
	save,
	targetItemInstanceId,
}: readRuntimeMissingRequirementItemIdsFromGameSave.Props) => [
	...new Set(
		requirements.flatMap((requirement) => {
			if (requirement.type === "stored") {
				return readRuntimeStoredRequirementQuantityFromGameSave({
					itemId: requirement.itemId as ItemId,
					save,
					targetItemInstanceId,
				}) >= requirement.quantity
					? []
					: [
							requirement.itemId,
						];
			}

			if (requirement.type === "proximity") {
				// Spatial requirements are not storage targets. Missing proximity item IDs must not
				// enter the DnD stored-requirement route.
				return [];
			}

			return readGameSaveItemQuantityByScope({
				itemId: requirement.itemId as ItemId,
				save,
				scope: requirement.scope,
			}) >= requirement.quantity
				? []
				: [
						requirement.itemId,
					];
		}),
	),
];

export namespace readRuntimeRequirementsReadyFromGameSave {
	export interface Props {
		requirements: readonly RuntimeActivationRequirement[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readRuntimeRequirementsReadyFromGameSave = ({
	requirements,
	save,
	targetItemInstanceId,
}: readRuntimeRequirementsReadyFromGameSave.Props) =>
	readRuntimeActivationRequirementViewsFromGameSave({
		requirements,
		save,
		targetItemInstanceId,
	}).every((requirement) => {
		if (requirement.type === "stored" || requirement.type === "passive") {
			return requirement.stored >= requirement.quantity;
		}

		return requirement.satisfied;
	});
