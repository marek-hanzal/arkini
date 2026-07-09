import type { ItemTargetLimit } from "~/limit/ItemTargetLimit";
import { mergeItemTargetLimits } from "~/limit/mergeItemTargetLimits";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readOutputTargetLimits } from "~/limit/readOutputTargetLimits";

export namespace readEffectiveOutputTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		includePendingCraftJobs?: boolean;
		includePendingCraftSourceItems?: boolean;
		includePendingProducerJobs?: boolean;
		nowMs?: number;
		lootPlan: EffectiveLine["lootPlan"];
		save: GameSave;
	}
}

export const readEffectiveOutputTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds,
	includePendingCraftJobs,
	includePendingCraftSourceItems,
	includePendingProducerJobs,
	nowMs,
	lootPlan,
	save,
}: readEffectiveOutputTargetLimits.Props): ItemTargetLimit[] =>
	mergeItemTargetLimits(
		readOutputTargetLimits({
			config,
			ignoredBoardItemInstanceIds,
			includePendingCraftJobs,
			includePendingCraftSourceItems,
			includePendingProducerJobs,
			nowMs,
			output: lootPlan.baseOutput,
			save,
		}),
	);
