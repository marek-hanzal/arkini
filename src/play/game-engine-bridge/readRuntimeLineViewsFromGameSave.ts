import { match } from "ts-pattern";
import type { LineView } from "~/board/view/LineViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import { readDefaultEffectLineId } from "~/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/producer/readDefaultLineId";
import { readEffectLineLocked } from "~/producer/readEffectLineLocked";
import { readLineKind } from "~/producer/readLineKind";
import { readLineDurationMs } from "~/producer/readLineDurationMs";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/play/game-engine-bridge/readRuntimeActivationInputView";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeLineActiveEffectBonusLines,
} from "~/play/game-engine-bridge/readRuntimeEffectOperationSummary";
import {
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
} from "~/time/GameTime";
import { readActivationInputRequiredQuantity } from "~/activation/readActivationInputRequiredQuantity";
import { readEffectiveOutputTargetLimits } from "~/limit/readEffectiveOutputTargetLimits";
import { readTargetLimitBlocked } from "~/limit/readTargetLimitBlocked";
import { readRuntimeLineOutputViews } from "~/play/game-engine-bridge/readRuntimeLineOutputViews";
import {
	readLineDefinition,
	type GameLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";

export namespace readRuntimeLineViewsFromGameSave {
	export interface Props {
		config: GameConfig;
		maxQueueSize: number;
		nowMs: number;
		producerDefinition: GameProducerCapabilityDefinition;
		lineIds: readonly string[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

type RuntimeProducerQueueViewState = {
	activeJob?: GameSaveProducerJob;
	activeJobFacts?: WorldProducerJobFacts;
	jobs: readonly GameSaveProducerJob[];
	producerJobFacts: readonly WorldProducerJobFacts[];
	queueBlockedReason?: "delivery_blocked" | "paused";
	queueFull: boolean;
	queueUsed: number;
};

type RuntimeLineTimingViewState = Pick<
	LineView,
	| "deliveryBlocked"
	| "durationMs"
	| "pausedAtMs"
	| "progress"
	| "readyAtMs"
	| "remainingMs"
	| "startAtMs"
>;

type RuntimeLineInputViewState = Pick<
	LineView,
	"inputItemIds" | "inputs" | "inputsAvailable" | "inputsReady"
>;

type RuntimeLineDefaultSelection = {
	readonly selectedDefaultEffectLineId?: string;
	readonly selectedDefaultProductLineId?: string;
};

const isRuntimeEffectRequirementActive = (requirement: EffectiveLine["requirements"][number]) =>
	requirement.kind === "grant.blockStart" ? !requirement.ready : requirement.ready;

const shouldDisplayRuntimeEffectRequirement = (
	requirement: EffectiveLine["requirements"][number],
) => {
	if (requirement.display === "never") return false;
	if (requirement.display === "always") return true;
	if (requirement.display === "whenActive") {
		return isRuntimeEffectRequirementActive(requirement);
	}
	return !requirement.ready;
};

const readRuntimeStoredLineInputQuantityFromGameSave = ({
	itemId,
	lineId,
	save,
	targetItemInstanceId,
}: {
	itemId: string;
	lineId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => save.producerInputs[targetItemInstanceId]?.lineInputs[lineId]?.items[itemId] ?? 0;

const readLineIdsVisibleOrCurrentlyQueued = ({
	producerJobs,
	lineIds,
	visibleLineIds,
}: {
	producerJobs: readonly GameSave["producerJobs"][string][];
	lineIds: readonly string[];
	visibleLineIds: readonly string[];
}) => {
	const visible = new Set(visibleLineIds);
	const jobLineIds = new Set(producerJobs.map((job) => job.lineId));

	return lineIds.filter((lineId) => visible.has(lineId) || jobLineIds.has(lineId));
};

const readProducerQueueBlockedReason = (
	producerJobFacts: readonly WorldProducerJobFacts[],
): RuntimeProducerQueueViewState["queueBlockedReason"] => {
	const blockingStatus =
		producerJobFacts.find((facts) => facts.status === "delivery_blocked")?.status ??
		producerJobFacts.find((facts) => facts.status === "paused")?.status;

	return match(blockingStatus)
		.with("delivery_blocked", () => "delivery_blocked" as const)
		.with("paused", () => "paused" as const)
		.otherwise(() => undefined);
};

const readRuntimeProducerQueueViewState = ({
	maxQueueSize,
	nowMs,
	save,
	targetItemInstanceId,
}: {
	maxQueueSize: number;
	nowMs: number;
	save: GameSave;
	targetItemInstanceId: string;
}): RuntimeProducerQueueViewState => {
	const producerJobFacts = readWorldProducerJobFacts({
		nowMs,
		save,
	}).filter((facts) => facts.itemInstanceId === targetItemInstanceId);
	const jobs = producerJobFacts.map((facts) => facts.job);
	const queueUsed = jobs.length;
	const activeJobFacts = producerJobFacts.find((facts) => facts.queueIndex === 0);

	return {
		activeJob: activeJobFacts?.job,
		activeJobFacts,
		jobs,
		producerJobFacts,
		queueBlockedReason: readProducerQueueBlockedReason(producerJobFacts),
		queueFull: queueUsed >= maxQueueSize,
		queueUsed,
	};
};

const readRuntimeLineDefaultSelection = ({
	itemInstanceId,
	save,
	visibleLineIds,
}: {
	itemInstanceId: string;
	save: GameSave;
	visibleLineIds: readonly string[];
}): RuntimeLineDefaultSelection => ({
	selectedDefaultEffectLineId: readDefaultEffectLineId({
		lineIds: visibleLineIds,
		itemInstanceId,
		save,
	}),
	selectedDefaultProductLineId: readDefaultLineId({
		lineIds: visibleLineIds,
		itemInstanceId,
		save,
	}),
});

const readRuntimeLineIsSelectedDefault = ({
	defaultSelection,
	kind,
	lineId,
}: {
	defaultSelection: RuntimeLineDefaultSelection;
	kind: LineView["kind"];
	lineId: string;
}) =>
	match(kind)
		.with("effect", () => lineId === defaultSelection.selectedDefaultEffectLineId)
		.with("product", () => lineId === defaultSelection.selectedDefaultProductLineId)
		.exhaustive();

const readRuntimeLineJobs = ({
	lineId,
	queueState,
}: {
	lineId: string;
	queueState: RuntimeProducerQueueViewState;
}) =>
	queueState.jobs
		.filter((job) => job.lineId === lineId)
		.sort((left, right) => left.startAtMs - right.startAtMs || left.id.localeCompare(right.id));

const readRuntimeLineTimingViewState = ({
	activeJobFacts,
	effectiveLineDurationMs,
	nowMs,
}: {
	activeJobFacts?: WorldProducerJobFacts;
	effectiveLineDurationMs: number;
	nowMs: number;
}): RuntimeLineTimingViewState => {
	const activeJob = activeJobFacts?.job;
	if (!activeJob) {
		return {
			durationMs: effectiveLineDurationMs,
		};
	}

	const deliveryBlocked = activeJobFacts.status === "delivery_blocked";
	const lineClockNowMs = activeJob.pausedAtMs ?? nowMs;

	return {
		deliveryBlocked,
		durationMs: readGameTimeDurationMs({
			readyAtMs: activeJob.readyAtMs,
			startAtMs: activeJob.startAtMs,
		}),
		pausedAtMs: activeJob.pausedAtMs,
		progress: deliveryBlocked
			? undefined
			: readGameTimeProgress({
					nowMs: lineClockNowMs,
					readyAtMs: activeJob.readyAtMs,
					startAtMs: activeJob.startAtMs,
				}),
		readyAtMs: activeJob.readyAtMs,
		remainingMs: deliveryBlocked
			? undefined
			: readGameTimeRemainingMs({
					nowMs: lineClockNowMs,
					readyAtMs: activeJob.readyAtMs,
				}),
		startAtMs: activeJob.startAtMs,
	};
};

const readRuntimeLineInputViewState = ({
	line,
	lineId,
	save,
	targetItemInstanceId,
}: {
	line: GameLineDefinition;
	lineId: string;
	save: GameSave;
	targetItemInstanceId: string;
}): RuntimeLineInputViewState => {
	const inputs = (line.inputs ?? []).map((input) =>
		readRuntimeActivationInputView({
			available: readRuntimeActivationInputAvailableQuantityFromGameSave({
				itemId: input.itemId,
				save,
				targetItemInstanceId,
			}),
			input,
			stored: readRuntimeStoredLineInputQuantityFromGameSave({
				itemId: input.itemId,
				lineId,
				save,
				targetItemInstanceId,
			}),
		}),
	);

	return {
		inputItemIds: inputs.map((input) => input.itemId),
		inputs,
		inputsReady: inputs.every(
			(input) => input.stored >= readActivationInputRequiredQuantity(input),
		),
		inputsAvailable: inputs.every(
			(input) =>
				input.stored +
					readRuntimeActivationInputAvailableQuantityFromGameSave({
						itemId: input.itemId,
						save,
						targetItemInstanceId,
					}) >=
				readActivationInputRequiredQuantity(input),
		),
	};
};

const readRuntimeLineStartRequirementsReady = (effectiveLine: EffectiveLine) => {
	const hasStartRequirements = effectiveLine.requirements.some(
		(requirement) => requirement.phase === "start",
	);

	if (effectiveLine.startRequirementsReady === false) return false;
	if (hasStartRequirements) return true;
	return undefined;
};

const readRuntimeLineEffectRequirementViews = (effectiveLine: EffectiveLine) =>
	effectiveLine.requirements.filter(shouldDisplayRuntimeEffectRequirement).map((requirement) => ({
		kind: match(requirement.kind)
			.with("grant.require", "grant.blockStart", "nearby.require", (kind) => kind)
			.otherwise(() => undefined),
		label: requirement.label,
		ready: requirement.ready,
	}));

const readRuntimeLineEffectBenefitViewLines = ({
	config,
	line,
}: {
	config: GameConfig;
	line: GameLineDefinition;
}) =>
	line.effect
		? readRuntimeEffectBenefitLines({
				config,
				effectId: line.effect.id,
			})
		: undefined;

const readRuntimeLineTargetLimitViewState = ({
	config,
	effectiveLine,
	nowMs,
	save,
}: {
	config: GameConfig;
	effectiveLine: EffectiveLine;
	nowMs: number;
	save: GameSave;
}) => {
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

const readRuntimeLineViewFromDefinition = ({
	config,
	defaultSelection,
	line,
	lineId,
	maxQueueSize,
	nowMs,
	queueState,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	defaultSelection: RuntimeLineDefaultSelection;
	line: GameLineDefinition;
	lineId: string;
	maxQueueSize: number;
	nowMs: number;
	queueState: RuntimeProducerQueueViewState;
	save: GameSave;
	targetItemInstanceId: string;
}): LineView | undefined => {
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

	const effectBonusLines = readRuntimeLineActiveEffectBonusLines({
		baseDurationMs,
		config,
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
		effectBonusLines: effectBonusLines.length ? effectBonusLines : undefined,
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
			effectiveLine,
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

export const readRuntimeLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerDefinition,
	lineIds,
	save,
	targetItemInstanceId,
}: readRuntimeLineViewsFromGameSave.Props): LineView[] => {
	const queueState = readRuntimeProducerQueueViewState({
		maxQueueSize,
		nowMs,
		save,
		targetItemInstanceId,
	});
	const visibleLineIds = readVisibleLineIds({
		config,
		nowMs,
		producerDefinition,
		itemInstanceId: targetItemInstanceId,
		lineIds,
		save,
	});
	const defaultSelection = readRuntimeLineDefaultSelection({
		itemInstanceId: targetItemInstanceId,
		save,
		visibleLineIds,
	});

	return readLineIdsVisibleOrCurrentlyQueued({
		producerJobs: queueState.jobs,
		lineIds,
		visibleLineIds,
	}).flatMap((lineId) => {
		const line = readLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) return [];

		const view = readRuntimeLineViewFromDefinition({
			config,
			defaultSelection,
			line,
			lineId,
			maxQueueSize,
			nowMs,
			queueState,
			save,
			targetItemInstanceId,
		});

		return view
			? [
					view,
				]
			: [];
	});
};
