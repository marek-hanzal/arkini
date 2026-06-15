import type { ItemId } from "~/v0/manifest/manifestId";

export interface UpgradeCostDefinition {
	itemId: ItemId;
	quantity: number;
}
