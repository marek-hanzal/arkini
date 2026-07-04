import { readGameCheatEffectiveDurationMs } from "~/cheat/GameCheatSpeedMode";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import { readEffectiveLineRequirements } from "~/effects/readEffectiveLineRequirements";
import { readEffectiveOutputEntries } from "~/effects/readEffectiveOutputEntries";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";

export namespace readEffectiveLine {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		ignoreCapacitySpendRequirements?: boolean;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs?: number;
		itemInstanceId: string;
		line: GameLineDefinition;
		lineId: string;
		save: GameSave;
	}
}

export const readEffectiveLine = ({
	baseDurationMs,
	config,
	ignoreCapacitySpendRequirements,
	ignoredProducerJobIds,
	nowMs,
	itemInstanceId,
	line,
	lineId,
	save,
}: readEffectiveLine.Props): EffectiveLine => {
	const targetCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: itemInstanceId,
	});
	const grantIds = readGameWorldGrantIds({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
	});
	const effectiveOutput = readEffectiveOutputEntries({
		config,
		grantIds,
		output: line.output ?? [],
		itemInstanceId,
		lineId,
		lineVisible: line.visibility !== "hidden",
		save,
		targetCell,
	});
	const lineRequirements = readEffectiveLineRequirements({
		config,
		grantIds,
		ignoreCapacitySpendRequirements,
		itemInstanceId,
		line,
		lineId,
		save,
		targetCell,
	});
	const visible = line.output
		? effectiveOutput.visibleOutput.length > 0
		: line.visibility !== "hidden";
	const durationMultiplier = effectiveOutput.durationMultiplier;
	const durationMs = Math.max(0, Math.ceil(baseDurationMs * durationMultiplier));

	return {
		appliedEffects: effectiveOutput.appliedEffects,
		blocked: lineRequirements.blocked,
		blockReasons: lineRequirements.blockReasons,
		durationMs: readGameCheatEffectiveDurationMs({
			durationMs,
			save,
		}),
		effectDurationMultiplier: durationMultiplier === 1 ? undefined : durationMultiplier,
		grantIds: [
			...grantIds,
		].sort(),
		startRequirementsReady: lineRequirements.startRequirementsReady,
		lootPlan: {
			baseOutput: effectiveOutput.rollableOutput,
			chanceItems: effectiveOutput.chanceItems,
			visibleOutput: effectiveOutput.visibleOutput,
		},
		requirements: lineRequirements.requirements,
		visible,
	};
};
