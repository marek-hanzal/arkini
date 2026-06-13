import type { ItemId } from "~/manifest/data/manifestId";

export interface PlayerInventoryRow {
	id: string;
	itemDefinitionId: string;
	slotIndex: number;
	quantity: number;
}

export type PlayerInventoryPlacementPlan =
	| {
			type: "update";
			stackId: string;
			slotIndex: number;
			itemId: ItemId;
			quantity: number;
	  }
	| {
			type: "insert";
			stackId: string;
			slotIndex: number;
			itemId: ItemId;
			quantity: number;
	  };
