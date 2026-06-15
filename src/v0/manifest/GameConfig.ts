import type { AssetDefinition } from "./asset";
import { GameAssetDefinitions } from "./config/GameAssetDefinitions";
import { GameDefinition } from "./config/GameDefinition";
import { GameItemDefinitions } from "./config/GameItemDefinitions";
import { GameLootTableDefinitions } from "./config/GameLootTableDefinitions";
import { GameResourceDefinitions } from "./config/GameResourceDefinitions";
import { GameStartingState } from "./config/GameStartingState";
import { GameUpgradeDefinitions } from "./config/GameUpgradeDefinitions";
import type { ItemDefinition } from "./item";
import type { LootTableDefinition } from "./lootTable";
import type { ResourceDefinition } from "./resource";
import type { GameStartingStateDefinition } from "./type/GameStartingStateDefinition";
import type { UpgradeDefinition } from "~/v0/manifest/upgrade/UpgradeDefinition";

// One config owns the gameplay shape. The heavy data lives in focused definition
// files, because one 3000-line god object is how codebases start wearing capes.
export const GameConfig = {
	game: GameDefinition,
	assets: GameAssetDefinitions,
	resources: GameResourceDefinitions,
	lootTables: GameLootTableDefinitions,
	upgrades: GameUpgradeDefinitions,
	items: GameItemDefinitions,
	startingState: GameStartingState,
} satisfies GameConfig.Shape;

export type GameConfig = typeof GameConfig;
export namespace GameConfig {
	export interface Shape {
		game: {
			id: "arkini";
			title: "Arkini";
			board: {
				width: 7;
				height: 9;
			};
			inventory: {
				slots: number;
			};
		};
		assets: readonly AssetDefinition[];
		resources: readonly ResourceDefinition[];
		lootTables: readonly LootTableDefinition[];
		upgrades: readonly UpgradeDefinition[];
		items: readonly ItemDefinition[];
		startingState: GameStartingStateDefinition;
	}
}
