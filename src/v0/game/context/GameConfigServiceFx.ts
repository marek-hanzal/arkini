import { Context } from "effect";
import type { AssetDefinition } from "~/v0/manifest/asset";
import type { GameConfig } from "~/v0/manifest/GameConfig";
import type { GameDataIndex } from "~/v0/manifest/createGameDataIndex";
import type { ItemDefinition } from "~/v0/manifest/item";
import type { ItemMergeRule } from "~/v0/manifest/itemMergeRule";
import type { ItemId, LootTableId, UpgradeId } from "~/v0/manifest/manifestId";
import type { ActivationDefinition } from "~/v0/manifest/activation/ActivationDefinition";
import type { ProducerDefinition } from "~/v0/manifest/activation/ProducerDefinition";
import type { StashDefinition } from "~/v0/manifest/activation/StashDefinition";
import type { LootTableDefinition } from "~/v0/manifest/lootTable";
import type { UpgradeDefinition } from "~/v0/manifest/upgrade/UpgradeDefinition";
import type { ResourceDefinition } from "~/v0/manifest/resource";

export interface GameConfigSummary {
	assetCount: number;
	itemCount: number;
	mergeCount: number;
	producerCount: number;
	craftRecipeCount: number;
	dropTableCount: number;
}

export interface GameConfigService {
	config: GameConfig;
	index: GameDataIndex;
	getAsset(assetId: string): AssetDefinition | undefined;
	getResource(resourceId: string): ResourceDefinition | undefined;
	getItem(itemId: string): ItemDefinition | undefined;
	getProducer(itemId: string): ProducerDefinition | undefined;
	getStash(itemId: string): StashDefinition | undefined;
	getActivation(itemId: string): ActivationDefinition | undefined;
	getCraftRecipe(recipeId: string): GameDataIndex["craftRecipes"][number] | undefined;
	getCraftRecipeForTarget(itemId: string): GameDataIndex["craftRecipes"][number] | undefined;
	getCraftRecipesForInput(itemId: string): GameDataIndex["craftRecipes"];
	getMergeRulesForInput(itemId: string): GameDataIndex["merges"];
	getLootTable(tableId: string | LootTableId): LootTableDefinition | undefined;
	getUpgrade(upgradeId: string | UpgradeId): UpgradeDefinition | undefined;
	isProducer(itemId: string): boolean;
	isStash(itemId: string): boolean;
	isMergeableItem(itemId: string): boolean;
	resolveMergeRule(
		sourceItemId: string | ItemId,
		targetItemId: string | ItemId,
	):
		| (ItemMergeRule & {
				sourceItemId: ItemId;
		  })
		| undefined;
	summary(): GameConfigSummary;
}

export class GameConfigServiceFx extends Context.Tag("GameConfigServiceFx")<
	GameConfigServiceFx,
	GameConfigService
>() {
	//
}
