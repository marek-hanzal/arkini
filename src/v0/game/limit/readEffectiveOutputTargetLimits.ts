import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import { mergeItemTargetLimits } from "~/v0/game/limit/mergeItemTargetLimits";
import type { EffectiveProducerLine } from "~/v0/game/effects/EffectiveProducerLine";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readOutputTargetLimits } from "~/v0/game/limit/readOutputTargetLimits";

export namespace readEffectiveOutputTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		includePendingCraftJobs?: boolean;
		includePendingCraftSourceItems?: boolean;
		includePendingProducerJobs?: boolean;
		nowMs?: number;
		lootPlan: EffectiveProducerLine["lootPlan"];
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
