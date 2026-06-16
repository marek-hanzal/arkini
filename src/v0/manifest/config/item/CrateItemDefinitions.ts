import type { ItemDefinition } from "../../item";
import { StandardCrateItemDefinitions } from "./container/StandardCrateItemDefinitions";
import { KeyItemDefinitions } from "./container/KeyItemDefinitions";
import { EpicCrateItemDefinitions } from "./container/EpicCrateItemDefinitions";

export const CrateItemDefinitions = [
	...StandardCrateItemDefinitions,
	...KeyItemDefinitions,
	...EpicCrateItemDefinitions,
] satisfies ItemDefinition[];
