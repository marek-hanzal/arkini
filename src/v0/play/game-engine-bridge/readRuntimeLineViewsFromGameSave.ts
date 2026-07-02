import type { LineView } from "~/v0/board/view/LineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/v0/game/effects/EffectiveLine";
import { readEffectiveLine } from "~/v0/game/effects/readEffectiveLine";
import { readDefaultEffectLineId } from "~/v0/game/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/v0/game/producer/readDefaultLineId";
import { readEffectLineLocked } from "~/v0/game/producer/readEffectLineLocked";
import { readLineKind } from "~/v0/game/producer/readLineKind";
import { readLineDurationMs } from "~/v0/game/producer/readLineDurationMs";
import { readVisibleLineIds } from "~/v0/game/producer/readVisibleLineIds";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeLineActiveEffectBonusLines,
} from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";
import {
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
} from "~/v0/game/time/GameTime";
import { readActivationInputRequiredQuantity } from "~/v0/game/activation/readActivationInputRequiredQuantity";
import { readEffectiveOutputTargetLimits } from "~/v0/game/limit/readEffectiveOutputTargetLimits";
import { readTargetLimitBlocked } from "~/v0/game/limit/readTargetLimitBlocked";
import { readRuntimeLineOutputViews } from "~/v0/play/game-engine-bridge/readRuntimeLineOutputViews";
import {
	readLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/v0/game/config/readLineDefinition";

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

const readViewLineIds = ({
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

export const readRuntimeLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerDefinition,
	lineIds,
	save,
	targetItemInstanceId,
}: readRuntimeLineViewsFromGameSave.Props): LineView[] => {
	const producerJobFacts = readWorldProducerJobFacts({
		nowMs,
		save,
	}).filter((facts) => facts.itemInstanceId === targetItemInstanceId);
	const producerJobs = producerJobFacts.map((facts) => facts.job);
	const queueUsed = producerJobs.length;
	const producerQueueBlockedReason = producerJobFacts.some(
		(facts) => facts.status === "delivery_blocked",
	)
		? "delivery_blocked"
		: producerJobFacts.some((facts) => facts.status === "paused")
			? "paused"
			: undefined;
	const firstProducerJobFacts = producerJobFacts.find((facts) => facts.queueIndex === 0);
	const firstProducerJob = firstProducerJobFacts?.job;
	const queueFull = queueUsed >= maxQueueSize;
	const visibleLineIds = readVisibleLineIds({
		config,
		nowMs,
		producerDefinition,
		itemInstanceId: targetItemInstanceId,
		lineIds,
		save,
	});
	const selectedDefaultLineId = readDefaultLineId({
		lineIds: visibleLineIds,
		itemInstanceId: targetItemInstanceId,
		save,
	});
	const selectedDefaultEffectLineId = readDefaultEffectLineId({
		lineIds: visibleLineIds,
		itemInstanceId: targetItemInstanceId,
		save,
	});
	const viewLineIds = readViewLineIds({
		producerJobs,
		lineIds,
		visibleLineIds,
	});

	return viewLineIds.flatMap((lineId) => {
		const line = readLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) return [];
		const kind = readLineKind({
			line,
		});
		const isDefault =
			kind === "effect"
				? lineId === selectedDefaultEffectLineId
				: lineId === selectedDefaultLineId;

		const effectLocked = readEffectLineLocked({
			config,
			nowMs,
			itemInstanceId: targetItemInstanceId,
			lineId,
			save,
		});
		const jobs = producerJobs
			.filter((job) => job.lineId === lineId)
			.sort(
				(left, right) =>
					left.startAtMs - right.startAtMs || left.id.localeCompare(right.id),
			);
		const activeJobFacts =
			firstProducerJob?.lineId === lineId ? firstProducerJobFacts : undefined;
		const activeJob = activeJobFacts?.job;
		const deliveryBlocked = activeJobFacts?.status === "delivery_blocked";
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
		const durationMs = activeJob
			? readGameTimeDurationMs({
					readyAtMs: activeJob.readyAtMs,
					startAtMs: activeJob.startAtMs,
				})
			: effectiveLine.durationMs;
		const lineClockNowMs = activeJob?.pausedAtMs ?? nowMs;
		const progress =
			activeJob && !deliveryBlocked
				? readGameTimeProgress({
						nowMs: lineClockNowMs,
						readyAtMs: activeJob.readyAtMs,
						startAtMs: activeJob.startAtMs,
					})
				: undefined;
		const remainingMs =
			activeJob && !deliveryBlocked
				? readGameTimeRemainingMs({
						nowMs: lineClockNowMs,
						readyAtMs: activeJob.readyAtMs,
					})
				: undefined;

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
		const inputsReady = inputs.every(
			(input) => input.stored >= readActivationInputRequiredQuantity(input),
		);
		const inputsAvailable = inputs.every(
			(input) =>
				input.stored +
					readRuntimeActivationInputAvailableQuantityFromGameSave({
						itemId: input.itemId,
						save,
						targetItemInstanceId,
					}) >=
				readActivationInputRequiredQuantity(input),
		);
		const effectBonusLines = readRuntimeLineActiveEffectBonusLines({
			baseDurationMs,
			config,
			effectiveLine,
		});
		const targetLimits = readEffectiveOutputTargetLimits({
			config,
			includePendingCraftJobs: true,
			includePendingCraftSourceItems: true,
			includePendingProducerJobs: true,
			nowMs,
			lootPlan: effectiveLine.lootPlan,
			save,
		});
		const hasEffectStartRequirements = effectiveLine.requirements.some(
			(requirement) => requirement.phase === "start",
		);
		const startRequirementsReady =
			effectiveLine.startRequirementsReady === false
				? false
				: hasEffectStartRequirements
					? true
					: undefined;
		const effectRequirements = effectiveLine.requirements
			.filter(shouldDisplayRuntimeEffectRequirement)
			.map((requirement) => ({
				kind:
					requirement.kind === "grant.require" ||
					requirement.kind === "grant.blockStart" ||
					requirement.kind === "nearby.require"
						? requirement.kind
						: undefined,
				label: requirement.label,
				ready: requirement.ready,
			}));

		return [
			{
				blocked: effectiveLine.blocked,
				visible: effectiveLine.visible,
				effectLocked,
				effectPolarity: line.effect?.polarity,
				deliveryBlocked,
				outputLimitBlocked: readTargetLimitBlocked(targetLimits),
				durationMs,
				effectDurationMultiplier: effectiveLine.effectDurationMultiplier,
				effectBenefits: line.effect
					? readRuntimeEffectBenefitLines({
							config,
							effectId: line.effect.id,
						})
					: undefined,
				effectBonusLines: effectBonusLines.length ? effectBonusLines : undefined,
				effectRequirements: effectRequirements.length ? effectRequirements : undefined,
				startRequirementsReady,
				inProgress: jobs.length > 0,
				inputItemIds: inputs.map((input) => input.itemId),
				isDefault,
				kind,
				inputs,
				inputsReady,
				inputsAvailable,
				name: line.name,
				outputs: readRuntimeLineOutputViews({
					effectiveLine,
					save,
				}),
				lineId,
				queueUsed,
				pausedAtMs: activeJob?.pausedAtMs,
				progress,
				queueBlockedReason: producerQueueBlockedReason,
				queueFull,
				queueMax: maxQueueSize,
				jobs: jobs.length,
				readyAtMs: activeJob?.readyAtMs,
				remainingMs,
				targetLimits: targetLimits.length ? targetLimits : undefined,
				startAtMs: activeJob?.startAtMs,
			},
		];
	});
};
