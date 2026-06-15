import type { ItemId, ResourceId } from "../manifestId";

export interface GameStartingStateDefinition {
	resources: readonly {
		resourceId: ResourceId;
		quantity: number;
	}[];
	inventory: readonly {
		itemId: ItemId;
		quantity: number;
	}[];
	board: readonly {
		itemId: ItemId;
		x: number;
		y: number;
	}[];
}
