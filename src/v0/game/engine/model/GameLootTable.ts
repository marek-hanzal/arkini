import type { GameLootOutput } from "~/v0/game/engine/model/GameLootOutput";

export interface GameLootTable {
	name: string;
	output: readonly GameLootOutput[];
}
