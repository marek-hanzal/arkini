import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerDefaultEffectProductId } from "~/v0/game/producer/readProducerDefaultEffectProductId";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { readProducerEffectLineLocked } from "~/v0/game/producer/readProducerEffectLineLocked";
import { readProducerLineKind } from "~/v0/game/producer/readProducerLineKind";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeProductLineActiveEffectBonusLines,
} from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";
import {
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
} from "~/v0/game/time/GameTime";
import { readActivationInputRequiredQuantity } from "~/v0/game/activation/readActivationInputRequiredQuantity";
import { readEffectiveOutputTargetLimits } from "~/v0/game/limit/readEffectiveOutputTargetLimits";
import { readTargetLimitBlocked } from "~/v0/game/limit/readTargetLimitBlocked";
import { readRuntimeProductLineOutputViews } from "~/v0/play/game-engine-bridge/readRuntimeProductLineOutputViews";

export namespace readRuntimeProducerProductLineViewsFromGameSave {
	export interface Props {
		config: GameConfig;
		maxQueueSize: number;
		nowMs: number;
		productIds: readonly string[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const isRuntimeEffectRequirementActive = (
	requirement: EffectiveProducerProductLine["requirements"][number],
) => (requirement.kind === "grant.blockStart" ? !requirement.ready : requirement.ready);

const shouldDisplayRuntimeEffectRequirement = (
	requirement: EffectiveProducerProductLine["requirements"][number],
) => {
	if (requirement.display === "never") return false;
	if (requirement.display === "always") return true;
	if (requirement.display === "whenActive") {
		return isRuntimeEffectRequirementActive(requirement);
	}
	return !requirement.ready;
};

const readRuntimeStoredProductInputQuantityFromGameSave = ({
	itemId,
	productId,
	save,
	targetItemInstanceId,
}: {
	itemId: string;
	productId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => save.producerInputs[targetItemInstanceId]?.productInputs[productId]?.items[itemId] ?? 0;

const readViewProductIds = ({
	producerJobs,
	productIds,
	visibleProductIds,
}: {
	producerJobs: readonly GameSave["producerJobs"][string][];
	productIds: readonly string[];
	visibleProductIds: readonly string[];
}) => {
	const visible = new Set(visibleProductIds);
	const jobProductIds = new Set(producerJobs.map((job) => job.productId));

	return productIds.filter((productId) => visible.has(productId) || jobProductIds.has(productId));
};

export const readRuntimeProducerProductLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	productIds,
	save,
	targetItemInstanceId,
}: readRuntimeProducerProductLineViewsFromGameSave.Props): ProducerProductLineView[] => {
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
	const visibleProductIds = readVisibleProducerProductIds({
		config,
		nowMs,
		producerItemInstanceId: targetItemInstanceId,
		productIds,
		save,
	});
	const selectedDefaultProductId = readProducerDefaultProductId({
		productIds: visibleProductIds,
		producerItemInstanceId: targetItemInstanceId,
		save,
	});
	const selectedDefaultEffectProductId = readProducerDefaultEffectProductId({
		productIds: visibleProductIds,
		producerItemInstanceId: targetItemInstanceId,
		save,
	});
	const viewProductIds = readViewProductIds({
		producerJobs,
		productIds,
		visibleProductIds,
	});

	return viewProductIds.flatMap((productId) => {
		const product = config.products[productId];
		if (!product) return [];
		const lineKind = readProducerLineKind({
			product,
		});
		const isDefault =
			lineKind === "effect"
				? productId === selectedDefaultEffectProductId
				: productId === selectedDefaultProductId;

		const effectLocked = readProducerEffectLineLocked({
			config,
			nowMs,
			producerItemInstanceId: targetItemInstanceId,
			productId,
			save,
		});
		const jobs = producerJobs
			.filter((job) => job.productId === productId)
			.sort(
				(left, right) =>
					left.startAtMs - right.startAtMs || left.id.localeCompare(right.id),
			);
		const activeJobFacts =
			firstProducerJob?.productId === productId ? firstProducerJobFacts : undefined;
		const activeJob = activeJobFacts?.job;
		const deliveryBlocked = activeJobFacts?.status === "delivery_blocked";
		const baseDurationMs = readProducerProductDurationMs({
			product,
		});
		const effectiveProductLine = readEffectiveProducerProductLine({
			baseDurationMs,
			config,
			nowMs,
			producerItemInstanceId: targetItemInstanceId,
			product,
			productId,
			save,
		});
		const durationMs = activeJob
			? readGameTimeDurationMs({
					readyAtMs: activeJob.readyAtMs,
					startAtMs: activeJob.startAtMs,
				})
			: effectiveProductLine.durationMs;
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

		const inputs = (product.inputs ?? []).map((input) =>
			readRuntimeActivationInputView({
				available: readRuntimeActivationInputAvailableQuantityFromGameSave({
					itemId: input.itemId,
					save,
					targetItemInstanceId,
				}),
				input,
				stored: readRuntimeStoredProductInputQuantityFromGameSave({
					itemId: input.itemId,
					productId,
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
		const effectBonusLines = readRuntimeProductLineActiveEffectBonusLines({
			baseDurationMs,
			config,
			effectiveProductLine,
		});
		const targetLimits = readEffectiveOutputTargetLimits({
			config,
			includePendingCraftJobs: true,
			includePendingCraftSourceItems: true,
			includePendingProducerJobs: true,
			nowMs,
			lootPlan: effectiveProductLine.lootPlan,
			save,
		});
		const hasEffectStartRequirements = effectiveProductLine.requirements.some(
			(requirement) => requirement.phase === "start",
		);
		const startRequirementsReady =
			effectiveProductLine.startRequirementsReady === false
				? false
				: hasEffectStartRequirements
					? true
					: undefined;
		const effectRequirements = effectiveProductLine.requirements
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
				blocked: effectiveProductLine.blocked,
				visible: effectiveProductLine.visible,
				effectLocked,
				effectPolarity: product.activatesEffectId
					? config.effects[product.activatesEffectId]?.polarity
					: undefined,
				deliveryBlocked,
				outputLimitBlocked: readTargetLimitBlocked(targetLimits),
				durationMs,
				effectDurationMultiplier: effectiveProductLine.effectDurationMultiplier,
				effectBenefits: product.activatesEffectId
					? readRuntimeEffectBenefitLines({
							config,
							effectId: product.activatesEffectId,
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
				name: product.name,
				outputs: readRuntimeProductLineOutputViews({
					effectiveProductLine,
					save,
				}),
				productId,
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
