import type { GameQuantity } from "~/v0/game/engine/model/GameQuantity";
import type { WeightedLootTableEntry } from "~/v0/game/engine/model/WeightedLootTableEntry";

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
