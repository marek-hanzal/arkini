import type { GameConfig } from "~/config/GameConfigTypes";
import { formatItemLabel } from "~/config/validation/GameConfigValidationFormatting";
import { createGameplayGrantSource } from "~/config/validation/createGameplaySoftLockSource";
import { createItemRequirement } from "~/config/validation/GameplaySoftLockRequirements";

export const createPassiveGrantGameplaySources = (config: GameConfig) =>
	Object.entries(config.items).flatMap(([itemId, item]) =>
		(item.effects ?? []).flatMap((effect, effectIndex) =>
			effect.grants.map((grant) =>
				createGameplayGrantSource({
					label: `passive effect "${effect.id}" on ${formatItemLabel(config, itemId)}`,
					path: [
						"items",
						itemId,
						"effects",
						effectIndex,
					],
					requirements: [
						createItemRequirement({
							itemId,
							path: [
								"items",
								itemId,
							],
						}),
					],
					sourceId: `passive:${itemId}:${effect.id}:${grant.id}`,
					targetId: grant.id,
				}),
			),
		),
	);
