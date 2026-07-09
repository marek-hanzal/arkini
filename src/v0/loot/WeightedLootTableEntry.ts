import type { GameQuantity } from "~/loot/GameQuantity";

export interface WeightedLootTableEntry {
	itemId: string;
	weight: number;
	quantity?: GameQuantity;
}
