import type { LootTableDefinition } from "../lootTable";
import { ProducerLootTableDefinitions } from "./loot-table/ProducerLootTableDefinitions";
import { CrateLootTableDefinitions } from "./loot-table/CrateLootTableDefinitions";
import { UpgradeLootTableDefinitions } from "./loot-table/UpgradeLootTableDefinitions";

export const GameLootTableDefinitions = [
	...ProducerLootTableDefinitions,
	...CrateLootTableDefinitions,
	...UpgradeLootTableDefinitions,
] satisfies LootTableDefinition[];
