import type { GameConfig } from "~/config/GameConfigTypes";
import type { AddBlueprintDependencyItem } from "~/config/validation/BlueprintDependencyTypes";
import {
	readActivationOutputEffectEntries,
	readConfigLines,
} from "~/config/validation/GameConfigValidationReaders";
import { collectLineEffectDependencyItems } from "~/config/validation/collectLineEffectDependencyItems";

export const collectLineBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const { line, lineIndex, linePath, ownerItemId } of readConfigLines(config)) {
		const outputEntries = readActivationOutputEffectEntries({
			output: line.output ?? [],
			path: [
				...linePath,
				"output",
			],
		});

		for (const outputEntry of outputEntries) {
			if (!blueprintItemIds.has(outputEntry.itemId)) continue;
			const fromBlueprintItemId = outputEntry.itemId;
			addDependencyItem({
				fromBlueprintItemId,
				itemId: ownerItemId,
				path:
					lineIndex === undefined
						? [
								...linePath,
								"id",
							]
						: [
								"items",
								ownerItemId,
								"producer",
								"lines",
								lineIndex,
								"id",
							],
			});

			for (const [inputIndex, input] of (line.inputs ?? []).entries()) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId: input.itemId,
					path: [
						...linePath,
						"inputs",
						inputIndex,
						"itemId",
					],
				});
			}

			collectLineEffectDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				lineEffects: outputEntry.effects,
				path: [
					...outputEntry.path,
					"effects",
				],
			});
		}
	}
};
