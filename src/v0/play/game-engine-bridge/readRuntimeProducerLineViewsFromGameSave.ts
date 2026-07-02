import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { EffectiveProducerLine } from "~/v0/game/effects/EffectiveProducerLine";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerDefaultEffectLineId } from "~/v0/game/producer/readProducerDefaultEffectLineId";
import { readProducerDefaultLineId } from "~/v0/game/producer/readProducerDefaultLineId";
import { readProducerEffectLineLocked } from "~/v0/game/producer/readProducerEffectLineLocked";
import { readProducerLineKind } from "~/v0/game/producer/readProducerLineKind";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
import { readVisibleProducerLineIds } from "~/v0/game/producer/readVisibleProducerLineIds";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeProducerLineActiveEffectBonusLines,
} from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";
import {
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
} from "~/v0/game/time/GameTime";
import { readActivationInputRequiredQuantity } from "~/v0/game/activation/readActivationInputRequiredQuantity";
import { readEffectiveOutputTargetLimits } from "~/v0/game/limit/readEffectiveOutputTargetLimits";
import { readTargetLimitBlocked } from "~/v0/game/limit/readTargetLimitBlocked";
import { readRuntimeProducerLineOutputViews } from "~/v0/play/game-engine-bridge/readRuntimeProducerLineOutputViews";
import {
	readProducerLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/v0/game/config/readProducerLineDefinition";

export namespace readRuntimeProducerLineViewsFromGameSave {
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

const isRuntimeEffectRequirementActive = (
	requirement: EffectiveProducerLine["requirements"][number],
) => (requirement.kind === "grant.blockStart" ? !requirement.ready : requirement.ready);

const shouldDisplayRuntimeEffectRequirement = (
	requirement: EffectiveProducerLine["requirements"][number],
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

export const readRuntimeProducerLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerDefinition,
	lineIds,
	save,
	targetItemInstanceId,
}: readRuntimeProducerLineViewsFromGameSave.Props): ProducerLineView[] => {
	const producerJobFacts = readWorldProducerJobFacts({
		nowMs,
		save,
	}).filter((facts) => facts.producerItemInstanceId === targetItemInstanceId);
	const producerJobs = producerJobFacts.map((facts) => facts.job);
	const producerQueuedJobs = producerJobs.length;
	const producerQueueBlockedReason = producerJobFacts.some(
		(facts) => facts.status === "delivery_blocked",
	)
		? "delivery_blocked"
		: producerJobFacts.some((facts) => facts.status === "paused")
			? "paused"
			: undefined;
	const firstProducerJobFacts = producerJobFacts.find((facts) => facts.queueIndex === 0);
	const firstProducerJob = firstProducerJobFacts?.job;
	const queueFull = producerQueuedJobs >= maxQueueSize;
	const visibleLineIds = readVisibleProducerLineIds({
		config,
		nowMs,
		producerDefinition,
		producerItemInstanceId: targetItemInstanceId,
		lineIds,
		save,
	});
	const selectedDefaultLineId = readProducerDefaultLineId({
		lineIds: visibleLineIds,
		producerItemInstanceId: targetItemInstanceId,
		save,
	});
	const selectedDefaultEffectLineId = readProducerDefaultEffectLineId({
		lineIds: visibleLineIds,
		producerItemInstanceId: targetItemInstanceId,
		save,
	});
	const viewLineIds = readViewLineIds({
		producerJobs,
		lineIds,
		visibleLineIds,
	});

	return viewLineIds.flatMap((lineId) => {
		const line = readProducerLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) return [];
		const lineKind = readProducerLineKind({
			line,
		});
		const isDefault =
			lineKind === "effect"
				? lineId === selectedDefaultEffectLineId
				: lineId === selectedDefaultLineId;

		const effectLocked = readProducerEffectLineLocked({
			config,
			nowMs,
			producerItemInstanceId: targetItemInstanceId,
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
		const baseDurationMs = readProducerLineDurationMs({
			line,
		});
		const effectiveProducerLine = readEffectiveProducerLine({
			baseDurationMs,
			config,
			nowMs,
			producerItemInstanceId: targetItemInstanceId,
			line,
			lineId,
			save,
		});
		const durationMs = activeJob
			? readGameTimeDurationMs({
					readyAtMs: activeJob.readyAtMs,
					startAtMs: activeJob.startAtMs,
				})
			: effectiveProducerLine.durationMs;
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
		const effectBonusLines = readRuntimeProducerLineActiveEffectBonusLines({
			baseDurationMs,
			config,
			effectiveProducerLine,
		});
		const targetLimits = readEffectiveOutputTargetLimits({
			config,
			includePendingCraftJobs: true,
			includePendingCraftSourceItems: true,
			includePendingProducerJobs: true,
			nowMs,
			lootPlan: effectiveProducerLine.lootPlan,
			save,
		});
		const hasEffectStartRequirements = effectiveProducerLine.requirements.some(
			(requirement) => requirement.phase === "start",
		);
		const startRequirementsReady =
			effectiveProducerLine.startRequirementsReady === false
				? false
				: hasEffectStartRequirements
					? true
					: undefined;
		const effectRequirements = effectiveProducerLine.requirements
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
				blocked: effectiveProducerLine.blocked,
				visible: effectiveProducerLine.visible,
				effectLocked,
				effectPolarity: line.activatesEffectId
					? config.effects[line.activatesEffectId]?.polarity
					: undefined,
				deliveryBlocked,
				outputLimitBlocked: readTargetLimitBlocked(targetLimits),
				durationMs,
				effectDurationMultiplier: effectiveProducerLine.effectDurationMultiplier,
				effectBenefits: line.activatesEffectId
					? readRuntimeEffectBenefitLines({
							config,
							effectId: line.activatesEffectId,
						})
					: undefined,
				effectBonusLines: effectBonusLines.length ? effectBonusLines : undefined,
				effectRequirements: effectRequirements.length ? effectRequirements : undefined,
				startRequirementsReady,
				inProgress: jobs.length > 0,
				inputItemIds: inputs.map((input) => input.itemId),
				isDefault,
				lineKind,
				inputs,
				inputsReady,
				inputsAvailable,
				name: line.name,
				outputs: readRuntimeProducerLineOutputViews({
					effectiveProducerLine,
					save,
				}),
				lineId,
				producerQueuedJobs,
				pausedAtMs: activeJob?.pausedAtMs,
				progress,
				queueBlockedReason: producerQueueBlockedReason,
				queueFull,
				queueSize: maxQueueSize,
				queuedJobs: jobs.length,
				readyAtMs: activeJob?.readyAtMs,
				remainingMs,
				targetLimits: targetLimits.length ? targetLimits : undefined,
				startAtMs: activeJob?.startAtMs,
			},
		];
	});
};
