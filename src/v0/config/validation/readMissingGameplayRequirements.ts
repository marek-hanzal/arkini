import type { GameConfig } from "~/config/GameConfigTypes";
import {
	formatGrantSelector,
	formatIssuePath,
	formatItemLabel,
	formatItemSelector,
} from "~/config/validation/GameConfigValidationFormatting";
import { doesGameGrantSelectorMatchIdsLocal } from "~/config/validation/GameConfigSelectorValidation";
import { doesItemSelectorMatchReachableBoardItem } from "~/config/validation/readGameplayRequirementSatisfaction";
import type {
	GameplayReachability,
	GameplayRequirement,
} from "~/config/validation/GameplaySoftLockTypes";

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
