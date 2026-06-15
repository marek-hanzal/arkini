import type { ItemId } from "~/v0/manifest/manifestId";

export type InventoryPlacementPlan =
	| {
			type: "update";
			stackId: string;
			slotIndex: number;
			itemId: ItemId;
			quantity: number;
			stateJson: string;
	  }
	| {
			type: "insert";
			stackId: string;
			slotIndex: number;
			itemId: ItemId;
			quantity: number;
			stateJson: string;
	  };
