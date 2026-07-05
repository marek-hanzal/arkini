import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameplayItemSource } from "~/config/validation/createGameplaySoftLockSource";
import { formatItemLabel } from "~/config/validation/GameConfigValidationFormatting";
import { readActivationOutputItemIds } from "~/config/validation/GameConfigValidationReaders";
import { createItemRequirement } from "~/config/validation/GameplaySoftLockRequirements";

const readMergeOutputItemIds = (
	merge: NonNullable<GameConfig["items"][string]["merges"]>[number],
) => [
	...("resultItemId" in merge
		? [
				merge.resultItemId,
			]
		: []),
	...readActivationOutputItemIds(merge.output ?? []),
];

export const createMergeGameplaySources = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		(item.merges ?? []).flatMap((merge, mergeIndex) =>
			readMergeOutputItemIds(merge).map((outputItemId) =>
				createGameplayItemSource({
					label: `merge ${mergeIndex} from ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"merges",
						mergeIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
								"merges",
								mergeIndex,
							],
						}),
						createItemRequirement({
							itemId: merge.withItemId,
							path: [
								"items",
								itemId,
								"merges",
								mergeIndex,
								"withItemId",
							],
						}),
					],
					sourceId: `merge:${itemId}:${mergeIndex}:${merge.withItemId}:${outputItemId}`,
					targetId: outputItemId,
				}),
			),
		),
	);
