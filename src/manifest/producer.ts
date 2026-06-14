import type { ItemId, LootTableId } from "./manifestId";

export type ActivationTrigger = "click";
export type ActivationPlacement = "board_then_inventory";

export interface ActivationInputDefinition {
	itemId: ItemId;
	quantity: number;
	capacity: number;
}

export interface ActivationSharedDefinition {
	trigger: ActivationTrigger;
	placement: ActivationPlacement;
	outputTableId: LootTableId;
	inputs?: readonly ActivationInputDefinition[];
}

export interface ProducerDefinition extends ActivationSharedDefinition {
	type: "producer";
	cooldownMs: number;
}

export interface StashDefinition extends ActivationSharedDefinition {
	type: "stash";
	charges: number;
	onDepleted:
		| "remove"
		| {
				replaceWithItemId: ItemId;
		  };
}

export type ActivationDefinition = ProducerDefinition | StashDefinition;

export type ActivationOutput =
	| {
			type: "guaranteed";
			itemId: ItemId;
			quantity?: Quantity;
	  }
	| {
			type: "chance";
			itemId: ItemId;
			probability: number;
			quantity?: Quantity;
	  }
	| {
			type: "weighted";
			rolls?: Quantity;
			entries: readonly ActivationWeightedEntry[];
	  };

export interface ActivationWeightedEntry {
	itemId: ItemId;
	weight: number;
	quantity?: Quantity;
}

export type Quantity =
	| number
	| {
			min: number;
			max: number;
	  };
