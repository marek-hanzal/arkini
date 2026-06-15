import { z } from "zod";
import { AssetDefinitionSchema } from "./AssetDefinitionSchema";
import { GameMetaDefinitionSchema } from "./GameMetaDefinitionSchema";
import { ItemDefinitionSchema } from "./ItemDefinitionSchema";
import { LootTableDefinitionSchema } from "./LootTableDefinitionSchema";
import { ResourceDefinitionSchema } from "./ResourceDefinitionSchema";
import { StartingStateDefinitionSchema } from "./StartingStateDefinitionSchema";
import { UpgradeDefinitionSchema } from "./UpgradeDefinitionSchema";

export const GameConfigSchema = z.object({
	game: GameMetaDefinitionSchema,
	assets: z.array(AssetDefinitionSchema),
	resources: z.array(ResourceDefinitionSchema),
	lootTables: z.array(LootTableDefinitionSchema),
	upgrades: z.array(UpgradeDefinitionSchema),
	items: z.array(ItemDefinitionSchema),
	startingState: StartingStateDefinitionSchema,
});

type GameConfigSchema = typeof GameConfigSchema;
export namespace GameConfigSchema {
	export type Type = z.infer<GameConfigSchema>;
}
