import type { GameConfig } from "~/config/GameConfigTypes";
import type { BlueprintDependencyItem } from "~/config/validation/BlueprintDependencyTypes";
import { collectCraftRecipeBlueprintDependencies } from "~/config/validation/collectCraftRecipeBlueprintDependencies";
import { collectLineBlueprintDependencies } from "~/config/validation/collectLineBlueprintDependencies";
import { collectMergeBlueprintDependencies } from "~/config/validation/collectMergeBlueprintDependencies";
import {
	addBlueprintDependencyItem,
	createBlueprintDependencyCollector,
} from "~/config/validation/createBlueprintDependencyCollector";

export const collectBlueprintDependencyEdges = (config: GameConfig) => {
	const collector = createBlueprintDependencyCollector(config);
	const addDependencyItem = (item: BlueprintDependencyItem) =>
		addBlueprintDependencyItem(collector, item);

	collectCraftRecipeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectLineBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectMergeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});

	return collector;
};
