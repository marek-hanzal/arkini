import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type LootTable = GameConfig["lootTables"][string];

export type WeightedLootTableEntry = Extract<
	LootTable["output"][number],
	{
		type: "weighted";
	}
>["entries"][number];
