import type { ItemId } from "~/v0/manifest/manifestId";

export interface ActivationInputDefinition {
	itemId: ItemId;
	quantity: number;
	capacity: number;
}
