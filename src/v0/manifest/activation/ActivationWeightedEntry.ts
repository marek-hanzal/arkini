import type { ItemId } from "~/v0/manifest/manifestId";
import type { Quantity } from "~/v0/manifest/activation/Quantity";

export interface ActivationWeightedEntry {
	itemId: ItemId;
	weight: number;
	quantity?: Quantity;
}
