import type { GameLootOutput } from "~/v0/game/loot/GameLootOutput";

export interface GameLootTable {
	name: string;
	output: readonly GameLootOutput[];
}
