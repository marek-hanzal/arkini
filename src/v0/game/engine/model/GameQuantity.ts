import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

type LootOutput = GameConfig["lootTables"][string]["output"][number];

export type GameQuantity = NonNullable<
	Exclude<
		LootOutput,
		{
			type: "weighted";
		}
	>["quantity"]
>;
