import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isGameplayRequirementSatisfied } from "~/config/validation/GameplaySoftLockRequirements";
import type {
	GameplayReachability,
	GameplaySource,
} from "~/config/validation/GameplaySoftLockTypes";

const isGameplaySourceSatisfied = ({
	config,
	reachability,
	source,
}: {
	config: GameConfig;
	reachability: GameplayReachability;
	source: GameplaySource;
}) =>
	source.requirements.every((requirement) =>
		isGameplayRequirementSatisfied({
			config,
			reachableGrantIds: reachability.reachableGrantIds,
			reachableItemIds: reachability.reachableItemIds,
			requirement,
		}),
	);

const applyGameplaySourceReachability = ({
	reachability,
	source,
}: {
	reachability: GameplayReachability;
	source: GameplaySource;
}) =>
	match(source.targetKind)
		.with("item", () => {
			const changed = !reachability.reachableItemIds.has(source.targetId);
			reachability.reachableItemIds.add(source.targetId);
			return changed;
		})
		.with("grant", () => {
			const changed = !reachability.reachableGrantIds.has(source.targetId);
			reachability.reachableGrantIds.add(source.targetId);
			return changed;
		})
		.exhaustive();

export const readGameplaySoftLockReachability = (
	config: GameConfig,
	sources: readonly GameplaySource[],
): GameplayReachability => {
	const reachability = {
		reachableGrantIds: new Set<string>(),
		reachableItemIds: new Set<string>(),
	};
	const appliedSourceIds = new Set<string>();
	let changed = true;

	while (changed) {
		changed = false;

		for (const source of sources) {
			if (appliedSourceIds.has(source.sourceId)) continue;
			if (
				!isGameplaySourceSatisfied({
					config,
					reachability,
					source,
				})
			)
				continue;

			appliedSourceIds.add(source.sourceId);
			changed =
				applyGameplaySourceReachability({
					reachability,
					source,
				}) || changed;
		}
	}

	return reachability;
};
