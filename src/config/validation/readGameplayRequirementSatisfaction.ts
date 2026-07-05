import type { z } from "zod";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { doesGameGrantSelectorMatchIdsLocal } from "~/config/validation/GameConfigSelectorValidation";
import type { GameplayRequirement } from "~/config/validation/GameplaySoftLockTypes";

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
