import type { GameConfig } from "~/config/GameConfigTypes";
import type {
	BlueprintDependencyCollector,
	BlueprintDependencyItem,
} from "~/config/validation/BlueprintDependencyTypes";
import {
	readBlueprintDependenciesForItem,
	readBlueprintItemIds,
	readBlueprintItemIdsByCraftResultItemId,
} from "~/config/validation/readBlueprintDependencyItems";

export const addBlueprintDependencyItem = (
	collector: BlueprintDependencyCollector,
	item: BlueprintDependencyItem,
) => {
	for (const toBlueprintItemId of readBlueprintDependenciesForItem({
		blueprintItemIds: collector.blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: collector.blueprintItemIdsByCraftResultItemId,
		itemId: item.itemId,
	})) {
		const edges = collector.edgesByBlueprintItemId.get(item.fromBlueprintItemId) ?? [];
		edges.push({
			path: item.path,
			toBlueprintItemId,
			viaItemId: item.itemId,
		});
		collector.edgesByBlueprintItemId.set(item.fromBlueprintItemId, edges);
	}
};

export const createBlueprintDependencyCollector = (
	config: GameConfig,
): BlueprintDependencyCollector => {
	const blueprintItemIds = readBlueprintItemIds(config);
	return {
		blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: readBlueprintItemIdsByCraftResultItemId(
			config,
			blueprintItemIds,
		),
		edgesByBlueprintItemId: new Map(),
	};
};
