import type { GameLootOutput } from "~/loot/GameLootOutput";

export interface GameLootTable {
	name: string;
	output: readonly GameLootOutput[];
}
