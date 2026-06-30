import type { GameQuantity } from "~/v0/game/loot/GameQuantity";

export interface WeightedLootTableEntry {
	itemId: string;
	weight: number;
	quantity?: GameQuantity;
}
