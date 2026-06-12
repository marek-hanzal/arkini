import { createGameDataIndex } from "./indexBuilder";
import { gameDataManifest } from "./manifest";

export { gameDataManifest } from "./manifest";
export { pairKey } from "./merge";
export { resolveMergeRule } from "./resolveMergeRule";
export { assertGameDataManifest } from "./validation/manifest";

export type { AssetDefinition } from "./asset";
export type { BuildRecipeCost, ItemBuildRecipe } from "./build";
export type { AssetId, BuildRecipeId, ItemId, MergeDefinitionId } from "./ids";
export type { GameDataManifest } from "./manifestTypes";
export type { ItemDefinition } from "./item";
export type { ItemMergeRule } from "./merge";
export type { ProducerDefinition, ProducerDrop, ProducerMode, Quantity } from "./producer";

export const gameDataIndex = createGameDataIndex(gameDataManifest);
