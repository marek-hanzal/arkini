import type { AssetDefinition } from "../asset";
import { NaturalAssetDefinitions } from "./asset/NaturalAssetDefinitions";
import { CurrencyAssetDefinitions } from "./asset/CurrencyAssetDefinitions";
import { BlueprintAssetDefinitions } from "./asset/BlueprintAssetDefinitions";
import { BuildingAssetDefinitions } from "./asset/BuildingAssetDefinitions";
import { CrateAssetDefinitions } from "./asset/CrateAssetDefinitions";

export const GameAssetDefinitions = [
	...NaturalAssetDefinitions,
	...CurrencyAssetDefinitions,
	...BlueprintAssetDefinitions,
	...BuildingAssetDefinitions,
	...CrateAssetDefinitions,
] satisfies AssetDefinition[];
