import type { GameQuantity } from "~/v0/game/loot/GameQuantity";
import type { WeightedLootTableEntry } from "~/v0/game/loot/WeightedLootTableEntry";

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
