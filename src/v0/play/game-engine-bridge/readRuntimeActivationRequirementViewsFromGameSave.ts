import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";

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
}: {
	requirement: Extract<
		RuntimeActivationRequirement,
		{
			type: "passive";
		}
	>;
}): ActivationRequirementView => ({
	capacity: requirement.quantity,
	itemId: requirement.itemId as ItemId,
	quantity: requirement.quantity,
	stored: 0,
	type: "passive",
});

export const readRuntimeActivationRequirementViewsFromGameSave = ({
	requirements,
	save,
	targetItemInstanceId,
}: readRuntimeActivationRequirementViewsFromGameSave.Props): ActivationRequirementView[] =>
	requirements.map((requirement) =>
		requirement.type === "stored"
			? readRuntimeStoredRequirementViewFromGameSave({
					requirement,
					save,
					targetItemInstanceId,
				})
			: readRuntimePassiveRequirementViewFromGameSave({
					requirement,
				}),
	);

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
