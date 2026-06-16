import type { ItemDefinition } from "../../item";
import { PlantItemDefinitions } from "./natural/PlantItemDefinitions";
import { WoodItemDefinitions } from "./natural/WoodItemDefinitions";
import { StoneItemDefinitions } from "./natural/StoneItemDefinitions";
import { UtilityMaterialItemDefinitions } from "./natural/UtilityMaterialItemDefinitions";

export const NaturalItemDefinitions = [
	...PlantItemDefinitions,
	...WoodItemDefinitions,
	...StoneItemDefinitions,
	...UtilityMaterialItemDefinitions,
] satisfies ItemDefinition[];
