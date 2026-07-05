import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameplayItemSource } from "~/config/validation/createGameplaySoftLockSource";
import { formatItemLabel } from "~/config/validation/GameConfigValidationFormatting";
import { readActivationOutputItemIds } from "~/config/validation/GameConfigValidationReaders";
import { createItemRequirement } from "~/config/validation/GameplaySoftLockRequirements";

export const createRemovalGameplaySources = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		(item.removeBy ?? []).flatMap((removal, removeIndex) =>
			readActivationOutputItemIds(removal.output ?? []).map((outputItemId) =>
				createGameplayItemSource({
					label: `tile removal of ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"removeBy",
						removeIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
							],
						}),
						createItemRequirement({
							itemId: removal.itemId,
							path: [
								"items",
								itemId,
								"removeBy",
								removeIndex,
								"itemId",
							],
						}),
					],
					sourceId: `remove:${itemId}:${removeIndex}:output:${outputItemId}`,
					targetId: outputItemId,
				}),
			),
		),
	);
