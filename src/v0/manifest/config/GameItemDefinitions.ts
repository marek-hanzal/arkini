import type { ItemDefinition } from "../item";
import { NaturalItemDefinitions } from "./item/NaturalItemDefinitions";
import { CurrencyItemDefinitions } from "./item/CurrencyItemDefinitions";
import { BlueprintItemDefinitions } from "./item/BlueprintItemDefinitions";
import { BuildingItemDefinitions } from "./item/BuildingItemDefinitions";
import { CrateItemDefinitions } from "./item/CrateItemDefinitions";

export const GameItemDefinitions = [
	...NaturalItemDefinitions,
	...CurrencyItemDefinitions,
	...BlueprintItemDefinitions,
	...BuildingItemDefinitions,
	...CrateItemDefinitions,
] satisfies ItemDefinition[];
