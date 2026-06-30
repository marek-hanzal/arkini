import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readOutputTargetLimits } from "~/v0/game/limit/readOutputTargetLimits";

export namespace readEffectiveOutputTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		lootPlan: EffectiveProducerProductLine["lootPlan"];
		save: GameSave;
	}
}

const mergeLimits = (views: ItemTargetLimit[]) => {
	const merged = new Map<string, ItemTargetLimit>();

	for (const view of views) {
		const existing = merged.get(view.itemId);
		if (!existing) {
			merged.set(view.itemId, view);
			continue;
		}

		merged.set(view.itemId, {
			...existing,
			requiredQuantity: existing.requiredQuantity + view.requiredQuantity,
		});
	}

	return Array.from(merged.values());
};

export const readEffectiveOutputTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds,
	lootPlan,
	save,
}: readEffectiveOutputTargetLimits.Props): ItemTargetLimit[] =>
	mergeLimits(
		readOutputTargetLimits({
			config,
			ignoredBoardItemInstanceIds,
			output: lootPlan.baseOutput,
			save,
		}),
	);
