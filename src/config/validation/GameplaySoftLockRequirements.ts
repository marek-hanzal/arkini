import type { z } from "zod";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	formatGrantSelector,
	formatIssuePath,
	formatItemLabel,
	formatItemSelector,
} from "~/config/validation/GameConfigValidationFormatting";
import {
	readActivationOutputEffectEntries,
	type Line,
} from "~/config/validation/GameConfigValidationReaders";
import { doesGameGrantSelectorMatchIdsLocal } from "~/config/validation/GameConfigSelectorValidation";
import type {
	GameConfigRuntimeEffect,
	GameplayReachability,
	GameplayRequirement,
} from "~/config/validation/GameplaySoftLockTypes";

export const createGrantRequirement = ({
	path,
	selector,
}: {
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}): GameplayRequirement => ({
	kind: "grantSelector",
	path,
	selector,
});

export const createNearbyItemRequirement = ({
	path,
	selector,
}: {
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}): GameplayRequirement => ({
	kind: "nearbyItemSelector",
	path,
	selector,
});

export const createItemRequirement = ({
	itemId,
	path,
}: {
	itemId: string;
	path: GameConfigIssuePath;
}): GameplayRequirement => ({
	itemId,
	kind: "item",
	path,
});

export const readLineEffectGameplayRequirements = ({
	lineEffects,
	path,
}: {
	lineEffects: readonly GameConfigRuntimeEffect[];
	path: GameConfigIssuePath;
}) => {
	const requirements: GameplayRequirement[] = [];

	for (const [effectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			requirements.push({
				kind: "grantSelector",
				path: [
					...path,
					effectIndex,
					"selector",
				],
				selector: lineEffect.selector,
			});
		}

		if (lineEffect.kind === "nearby.require" || lineEffect.kind === "nearby.capacity.spend") {
			requirements.push({
				kind: "nearbyItemSelector",
				path: [
					...path,
					effectIndex,
					"items",
				],
				selector: lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			});
		}
	}

	return requirements;
};

type GameplayOutputSourceEntry = ReturnType<typeof readActivationOutputEffectEntries>[number] & {
	availabilityRequirements: GameplayRequirement[];
};

export const readGameplayOutputSourceEntries = ({
	line,
	output,
	path,
}: {
	line: Line;
	output: z.infer<typeof ActivationOutputSchema>;
	path: GameConfigIssuePath;
}): GameplayOutputSourceEntry[] =>
	readActivationOutputEffectEntries({
		output,
		path,
	}).flatMap((entry) =>
		readOutputAvailabilityRequirementVariants({
			entry,
			line,
		}).map((availabilityRequirements, variantIndex) => ({
			...entry,
			availabilityRequirements,
			sourceKey:
				variantIndex === 0
					? entry.sourceKey
					: `${entry.sourceKey}:availability:${variantIndex}`,
		})),
	);

const readOutputAvailabilityRequirementVariants = ({
	entry,
	line,
}: {
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number];
	line: Line;
}): GameplayRequirement[][] => {
	const visibilityRequirementVariants = readOutputVisibilityRequirementVariants({
		entry,
		line,
	});
	const enableRequirementVariants = readOutputEnableRequirementVariants(entry);

	return visibilityRequirementVariants.flatMap((visibilityRequirements) =>
		enableRequirementVariants.map((enableRequirements) => [
			...visibilityRequirements,
			...enableRequirements,
		]),
	);
};

const readOutputVisibilityRequirementVariants = ({
	entry,
	line,
}: {
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number];
	line: Line;
}): GameplayRequirement[][] => {
	if (line.visibility !== "hidden" && entry.visibility !== "hidden")
		return [
			[],
		];

	return entry.effects.flatMap((effect, effectIndex) => {
		const effectPath = [
			...entry.path,
			"effects",
			effectIndex,
		] satisfies GameConfigIssuePath;

		if (effect.kind === "grant.drop.show") {
			return [
				[
					createGrantRequirement({
						path: [
							...effectPath,
							"selector",
						],
						selector: effect.selector,
					}),
				],
			];
		}

		if (effect.kind === "grant.require" && effect.phase === "visibility") {
			return [
				[
					createGrantRequirement({
						path: [
							...effectPath,
							"selector",
						],
						selector: effect.selector,
					}),
				],
			];
		}

		if (effect.kind === "nearby.require" && effect.phase === "visibility") {
			return [
				[
					createNearbyItemRequirement({
						path: [
							...effectPath,
							"items",
						],
						selector: effect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
					}),
				],
			];
		}

		return [];
	});
};

const readOutputEnableRequirementVariants = (
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number],
): GameplayRequirement[][] => {
	if (entry.enabled !== false)
		return [
			[],
		];

	return entry.effects.flatMap((effect, effectIndex) => {
		if (effect.kind !== "grant.drop.enable") return [];

		return [
			[
				createGrantRequirement({
					path: [
						...entry.path,
						"effects",
						effectIndex,
						"selector",
					],
					selector: effect.selector,
				}),
			],
		];
	});
};

export const isGameplayRequirementSatisfied = ({
	config,
	reachableGrantIds,
	reachableItemIds,
	requirement,
}: {
	config: GameConfig;
	reachableGrantIds: ReadonlySet<string>;
	reachableItemIds: ReadonlySet<string>;
	requirement: GameplayRequirement;
}) => {
	if (requirement.kind === "item") {
		return reachableItemIds.has(requirement.itemId);
	}

	if (requirement.kind === "grantSelector") {
		return doesGameGrantSelectorMatchIdsLocal(reachableGrantIds, requirement.selector);
	}

	return doesItemSelectorMatchReachableBoardItem({
		config,
		reachableItemIds,
		selector: requirement.selector,
	});
};

export const doesItemSelectorMatchReachableBoardItem = ({
	config,
	reachableItemIds,
	selector,
}: {
	config: GameConfig;
	reachableItemIds: ReadonlySet<string>;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) =>
	Object.keys(config.items).some(
		(itemId) =>
			reachableItemIds.has(itemId) &&
			config.items[itemId]?.storage !== "inventory" &&
			doesResolvedDomainSelectorMatchId({
				entityId: itemId,
				selector,
			}),
	);

export const readMissingGameplayRequirements = ({
	config,
	reachability,
	requirements,
}: {
	config: GameConfig;
	reachability: GameplayReachability;
	requirements: readonly GameplayRequirement[];
}) =>
	requirements.flatMap((requirement) => {
		if (requirement.kind === "item") {
			return reachability.reachableItemIds.has(requirement.itemId)
				? []
				: [
						`item ${formatItemLabel(config, requirement.itemId)} at ${formatIssuePath(requirement.path)}`,
					];
		}

		if (requirement.kind === "grantSelector") {
			return doesGameGrantSelectorMatchIdsLocal(
				reachability.reachableGrantIds,
				requirement.selector,
			)
				? []
				: [
						`grant ${formatGrantSelector(config, requirement.selector)} at ${formatIssuePath(requirement.path)}`,
					];
		}

		return doesItemSelectorMatchReachableBoardItem({
			config,
			reachableItemIds: reachability.reachableItemIds,
			selector: requirement.selector,
		})
			? []
			: [
					`nearby item ${formatItemSelector(config, requirement.selector)} at ${formatIssuePath(requirement.path)}`,
				];
	});
