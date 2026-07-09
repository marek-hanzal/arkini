import type { GameConfig } from "~/config/GameConfigTypes";
import type { AddBlueprintDependencyItem } from "~/config/validation/BlueprintDependencyTypes";
import { readActivationOutputItemIds } from "~/config/validation/GameConfigValidationReaders";

export const collectMergeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [sourceItemId, item] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
			const outputBlueprintIds = [
				...("resultItemId" in merge
					? [
							merge.resultItemId,
						]
					: []),
				...readActivationOutputItemIds(merge.output ?? []),
			].filter((itemId) => blueprintItemIds.has(itemId));
			for (const blueprintItemId of outputBlueprintIds) {
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: sourceItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
					],
				});
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: merge.withItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
						"withItemId",
					],
				});
			}
		}
	}
};
