import type { GameQuantity } from "~/loot/GameQuantity";
import type { WeightedLootTableEntry } from "~/loot/WeightedLootTableEntry";

export type GameLootOutput =
	| {
			type: "guaranteed";
			itemId: string;
			quantity?: GameQuantity;
	  }
	| {
			type: "chance";
			itemId: string;
			chance: number;
			quantity?: GameQuantity;
	  }
	| {
			type: "weighted";
			rolls?: GameQuantity;
			entries: readonly WeightedLootTableEntry[];
	  };
