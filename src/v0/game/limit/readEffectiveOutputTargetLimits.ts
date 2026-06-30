import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import { mergeItemTargetLimits } from "~/v0/game/limit/mergeItemTargetLimits";
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

export const readEffectiveOutputTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds,
	lootPlan,
	save,
}: readEffectiveOutputTargetLimits.Props): ItemTargetLimit[] =>
	mergeItemTargetLimits(
		readOutputTargetLimits({
			config,
			ignoredBoardItemInstanceIds,
			output: lootPlan.baseOutput,
			save,
		}),
	);
