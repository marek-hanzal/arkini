import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";

export type RuntimeActivationRequirement =
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
			itemIds: string[];
			type: "proximity";
	  };

export namespace readRuntimeStoredRequirementQuantityFromGameSave {
	export interface Props {
		itemId: string;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readRuntimeStoredRequirementQuantityFromGameSave = ({
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

const readRuntimePassiveItemQuantityFromGameSave = ({
	itemId,
	save,
	scope,
}: {
	itemId: string;
	save: GameSave;
	scope: "board" | "inventory" | "board_or_inventory";
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
	stored: readRuntimePassiveItemQuantityFromGameSave({
		itemId: requirement.itemId,
		save,
		scope: requirement.scope,
	}),
	type: "passive",
});

const readProximityMatch = ({
	itemIds,
	save,
	targetItemInstanceId,
}: {
	itemIds: readonly string[];
	save: GameSave;
	targetItemInstanceId: string;
}) => {
	const target = save.board.items[targetItemInstanceId];
	if (!target) return undefined;

	const acceptedItemIds = new Set(itemIds);
	return Object.values(save.board.items)
		.flatMap((item) => {
			if (item.id === target.id || !acceptedItemIds.has(item.itemId)) {
				return [];
			}

			return [
				{
					distance: readGridDistance(target, item),
					item,
				},
			];
		})
		.sort(
			(left, right) =>
				left.distance - right.distance || left.item.id.localeCompare(right.item.id),
		)[0];
};

const readGridDistance = (left: GameSaveBoardItem, right: GameSaveBoardItem) =>
	Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));

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
	const match = readProximityMatch({
		itemIds: requirement.itemIds,
		save,
		targetItemInstanceId,
	});

	return {
		distance: requirement.distance,
		itemIds: requirement.itemIds as ItemId[],
		matchedDistance: match?.distance,
		matchedItemId: match?.item.itemId as ItemId | undefined,
		satisfied: match ? match.distance <= requirement.distance : false,
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

			return readRuntimePassiveItemQuantityFromGameSave({
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
