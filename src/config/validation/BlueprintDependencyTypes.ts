import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";

export type BlueprintDependencyEdge = {
	path: GameConfigIssuePath;
	toBlueprintItemId: string;
	viaItemId: string;
};

export type BlueprintDependencyCollector = {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	edgesByBlueprintItemId: Map<string, BlueprintDependencyEdge[]>;
};

export type BlueprintDependencyItem = {
	fromBlueprintItemId: string;
	itemId: string;
	path: GameConfigIssuePath;
};

export type BlueprintDependencyCycle = {
	blueprintItemIds: string[];
	edges: BlueprintDependencyEdge[];
};

export type AddBlueprintDependencyItem = (item: BlueprintDependencyItem) => void;
