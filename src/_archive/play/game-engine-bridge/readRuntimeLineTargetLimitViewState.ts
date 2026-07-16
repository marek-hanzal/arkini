import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import { readEffectiveOutputTargetLimits } from "~/limit/readEffectiveOutputTargetLimits";
import { readTargetLimitBlocked } from "~/limit/readTargetLimitBlocked";

export namespace readRuntimeLineTargetLimitViewState {
	export interface Props {
		config: GameConfig;
		effectiveLine: EffectiveLine;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeLineTargetLimitViewState = ({
	config,
	effectiveLine,
	nowMs,
	save,
}: readRuntimeLineTargetLimitViewState.Props) => {
	const targetLimits = readEffectiveOutputTargetLimits({
		config,
		includePendingCraftJobs: true,
		includePendingCraftSourceItems: true,
		includePendingProducerJobs: true,
		nowMs,
		lootPlan: effectiveLine.lootPlan,
		save,
	});

	return {
		outputLimitBlocked: readTargetLimitBlocked(targetLimits),
		targetLimits,
	};
};
