import { Context } from "effect";
import type { AssetDefinition } from "~/manifest/data/asset";
import type { GameConfig } from "~/manifest/data/GameConfig";
import type { GameDataIndex } from "~/manifest/data/createGameDataIndex";
import type { ItemDefinition } from "~/manifest/data/item";
import type { ItemMergeRule } from "~/manifest/data/itemMergeRule";
import type { BuildRecipeId, ItemId } from "~/manifest/data/manifestId";
import type { ProducerDefinition } from "~/manifest/data/producer";
import type { ResourceDefinition } from "~/manifest/data/resource";

export interface GameConfigSummary {
	assetCount: number;
	itemCount: number;
	mergeCount: number;
	producerCount: number;
	buildRecipeCount: number;
	dropTableCount: number;
}

export interface GameConfigService {
	config: GameConfig;
	index: GameDataIndex;
	getAsset(assetId: string): AssetDefinition | undefined;
	getResource(resourceId: string): ResourceDefinition | undefined;
	getItem(itemId: string): ItemDefinition | undefined;
	getProducer(itemId: string): ProducerDefinition | undefined;
	getBuildRecipe(recipeId: string): GameDataIndex["buildRecipes"][number] | undefined;
	getCraftRecipe(recipeId: string): GameDataIndex["craftRecipes"][number] | undefined;
	getCraftRecipeForTarget(itemId: string): GameDataIndex["craftRecipes"][number] | undefined;
	getCraftRecipesForInput(itemId: string): GameDataIndex["craftRecipes"];
	isProducer(itemId: string): boolean;
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
