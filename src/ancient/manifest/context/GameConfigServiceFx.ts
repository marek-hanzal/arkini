import { Context } from "effect";
import type { AssetDefinition } from "~/manifest/asset";
import type { GameConfig } from "~/manifest/GameConfig";
import type { GameDataIndex } from "~/manifest/createGameDataIndex";
import type { ItemDefinition } from "~/manifest/item";
import type { ItemMergeRule } from "~/manifest/itemMergeRule";
import type { ItemId, LootTableId, UpgradeId } from "~/manifest/manifestId";
import type {
	ActivationDefinition,
	ProducerDefinition,
	StashDefinition,
} from "~/manifest/producer";
import type { LootTableDefinition } from "~/manifest/lootTable";
import type { UpgradeDefinition } from "~/manifest/upgrade";
import type { ResourceDefinition } from "~/manifest/resource";

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
