import type { LineView } from "~/board/view/LineViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import { readEffectLineLocked } from "~/producer/readEffectLineLocked";
import { readLineDurationMs } from "~/producer/readLineDurationMs";
import { readLineKind } from "~/producer/readLineKind";
import { readEffectiveLineBonusSummary } from "~/effects/readEffectiveLineBonusEntries";
import { readRuntimeLineEffectBenefitViewLines } from "~/play/game-engine-bridge/readRuntimeLineEffectBenefitViewLines";
import { readRuntimeLineEffectRequirementViews } from "~/play/game-engine-bridge/readRuntimeLineEffectRequirementViews";
import { readRuntimeLineInputViewState } from "~/play/game-engine-bridge/readRuntimeLineInputViewState";
import { readRuntimeLineIsSelectedDefault } from "~/play/game-engine-bridge/readRuntimeLineIsSelectedDefault";
import { readRuntimeLineOutputViews } from "~/play/game-engine-bridge/readRuntimeLineOutputViews";
import { readRuntimeLineTargetLimitViewState } from "~/play/game-engine-bridge/readRuntimeLineTargetLimitViewState";
import { readRuntimeLineTimingViewState } from "~/play/game-engine-bridge/readRuntimeLineTimingViewState";
import type { RuntimeLineDefaultSelection } from "~/play/game-engine-bridge/readRuntimeLineDefaultSelection";
import type { RuntimeProducerQueueViewState } from "~/play/game-engine-bridge/readRuntimeProducerQueueViewState";

export namespace readRuntimeLineViewFromDefinition {
	export interface Props {
		config: GameConfig;
		defaultSelection: RuntimeLineDefaultSelection;
		line: GameLineDefinition;
		lineId: string;
		maxQueueSize: number;
		nowMs: number;
		queueState: RuntimeProducerQueueViewState;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const readRuntimeLineJobs = ({
	lineId,
	queueState,
}: Pick<readRuntimeLineViewFromDefinition.Props, "lineId" | "queueState">) =>
	queueState.jobs
		.filter((job) => job.lineId === lineId)
		.sort((left, right) => left.startAtMs - right.startAtMs || left.id.localeCompare(right.id));

const readRuntimeLineStartRequirementsReady = (
	effectiveLine: ReturnType<typeof readEffectiveLine>,
) => {
	const hasStartRequirements = effectiveLine.requirements.some(
		(requirement) => requirement.phase === "start",
	);

	if (effectiveLine.startRequirementsReady === false) return false;
	if (hasStartRequirements) return true;
	return undefined;
};

export const readRuntimeLineViewFromDefinition = ({
	config,
	defaultSelection,
	line,
	lineId,
	maxQueueSize,
	nowMs,
	queueState,
	save,
	targetItemInstanceId,
}: readRuntimeLineViewFromDefinition.Props): LineView | undefined => {
	const kind = readLineKind({
		line,
	});
	const baseDurationMs = readLineDurationMs({
		line,
	});
	const effectiveLine = readEffectiveLine({
		baseDurationMs,
		config,
		nowMs,
		itemInstanceId: targetItemInstanceId,
		line,
		lineId,
		save,
	});
	const lineJobs = readRuntimeLineJobs({
		lineId,
		queueState,
	});
	const activeJobFacts =
		queueState.activeJob?.lineId === lineId ? queueState.activeJobFacts : undefined;
	const targetLimitState = readRuntimeLineTargetLimitViewState({
		config,
		effectiveLine,
		nowMs,
		save,
	});

	if (kind === "product" && lineJobs.length === 0 && targetLimitState.outputLimitBlocked) {
		return undefined;
	}

	const effectBonusSummary = readEffectiveLineBonusSummary({
		baseDurationMs,
		effectiveLine,
	});
	const effectRequirements = readRuntimeLineEffectRequirementViews(effectiveLine);

	return {
		blocked: effectiveLine.blocked,
		visible: effectiveLine.visible,
		effectLocked: readEffectLineLocked({
			config,
			nowMs,
			itemInstanceId: targetItemInstanceId,
			lineId,
			save,
		}),
		effectPolarity: line.effect?.polarity,
		outputLimitBlocked: targetLimitState.outputLimitBlocked,
		...readRuntimeLineTimingViewState({
			activeJobFacts,
			effectiveLineDurationMs: effectiveLine.durationMs,
			nowMs,
		}),
		effectDurationMultiplier: effectiveLine.effectDurationMultiplier,
		effectBenefits: readRuntimeLineEffectBenefitViewLines({
			config,
			line,
		}),
		effectBonusLines: effectBonusSummary.lines.length
			? [
					...effectBonusSummary.lines,
				]
			: undefined,
		effectRequirements: effectRequirements.length ? effectRequirements : undefined,
		startRequirementsReady: readRuntimeLineStartRequirementsReady(effectiveLine),
		inProgress: lineJobs.length > 0,
		isDefault: readRuntimeLineIsSelectedDefault({
			defaultSelection,
			kind,
			lineId,
		}),
		kind,
		...readRuntimeLineInputViewState({
			line,
			lineId,
			save,
			targetItemInstanceId,
		}),
		name: line.name,
		outputs: readRuntimeLineOutputViews({
			effectBonusSummary,
			lootPlan: effectiveLine.lootPlan,
			save,
		}),
		lineId,
		queueUsed: queueState.queueUsed,
		queueBlockedReason: queueState.queueBlockedReason,
		queueFull: queueState.queueFull,
		queueMax: maxQueueSize,
		jobs: lineJobs.length,
		targetLimits: targetLimitState.targetLimits.length
			? targetLimitState.targetLimits
			: undefined,
	};
};
