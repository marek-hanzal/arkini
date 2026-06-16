import type { ItemDefinition } from "../../item";
import { TownhallItemDefinitions } from "./building/TownhallItemDefinitions";
import { LumberCampItemDefinitions } from "./building/LumberCampItemDefinitions";
import { QuarryItemDefinitions } from "./building/QuarryItemDefinitions";
import { CoalMineItemDefinitions } from "./building/CoalMineItemDefinitions";

export const BuildingItemDefinitions = [
	...TownhallItemDefinitions,
	...LumberCampItemDefinitions,
	...QuarryItemDefinitions,
	...CoalMineItemDefinitions,
] satisfies ItemDefinition[];
