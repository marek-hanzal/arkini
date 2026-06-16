import type { ItemDefinition } from "../../item";
import { BlankBlueprintItemDefinitions } from "./blueprint/BlankBlueprintItemDefinitions";
import { LumberCampBlueprintItemDefinitions } from "./blueprint/LumberCampBlueprintItemDefinitions";
import { QuarryBlueprintItemDefinitions } from "./blueprint/QuarryBlueprintItemDefinitions";
import { TownhallBlueprintItemDefinitions } from "./blueprint/TownhallBlueprintItemDefinitions";
import { LumberCampBlueprintUpgradeItemDefinitions } from "./blueprint/LumberCampBlueprintUpgradeItemDefinitions";
import { QuarryBlueprintUpgradeItemDefinitions } from "./blueprint/QuarryBlueprintUpgradeItemDefinitions";
import { TownhallBlueprintUpgradeItemDefinitions } from "./blueprint/TownhallBlueprintUpgradeItemDefinitions";

export const BlueprintItemDefinitions = [
	...BlankBlueprintItemDefinitions,
	...LumberCampBlueprintItemDefinitions,
	...QuarryBlueprintItemDefinitions,
	...TownhallBlueprintItemDefinitions,
	...LumberCampBlueprintUpgradeItemDefinitions,
	...QuarryBlueprintUpgradeItemDefinitions,
	...TownhallBlueprintUpgradeItemDefinitions,
] satisfies ItemDefinition[];
