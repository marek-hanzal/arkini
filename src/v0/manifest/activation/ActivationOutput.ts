import type { ItemId } from "~/v0/manifest/manifestId";
import type { ActivationWeightedEntry } from "~/v0/manifest/activation/ActivationWeightedEntry";
import type { Quantity } from "~/v0/manifest/activation/Quantity";

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
