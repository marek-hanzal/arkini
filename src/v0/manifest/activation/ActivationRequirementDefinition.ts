import type { ItemId } from "~/v0/manifest/manifestId";

export interface ActivationRequirementDefinition {
	itemId: ItemId;
	quantity: number;
	capacity: number;
}
