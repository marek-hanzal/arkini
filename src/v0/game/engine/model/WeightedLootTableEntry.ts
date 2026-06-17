import type { GameQuantity } from "~/v0/game/engine/model/GameQuantity";

export interface WeightedLootTableEntry {
	itemId: string;
	weight: number;
	quantity?: GameQuantity;
}
