import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductOutputItemIds } from "~/v0/game/config/readProductOutputItemIds";
import { readGameSaveItemQuantityByScope } from "~/v0/game/requirements/readGameSaveItemQuantityByScope";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerDefaultEffectProductId } from "~/v0/game/producer/readProducerDefaultEffectProductId";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { readProducerEffectLineLocked } from "~/v0/game/producer/readProducerEffectLineLocked";
import { readProducerLineKind } from "~/v0/game/producer/readProducerLineKind";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import {
	readRuntimeEffectBenefitLines,
	readRuntimeProductLineActiveEffectBonusLines,
} from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";
import {
	readRuntimeActivationRequirementViewsFromGameSave,
	readRuntimeMissingRequirementItemIdsFromGameSave,
	readRuntimeRequirementsReadyFromGameSave,
} from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";
import {
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
} from "~/v0/game/time/GameTime";
import { readActivationInputRequiredQuantity } from "~/v0/game/requirements/readActivationInputRequiredQuantity";

export namespace readRuntimeProducerProductLineViewsFromGameSave {
	export interface Props {
		config: GameConfig;
		maxQueueSize: number;
		nowMs: number;
		producerId: string;
		producerItemId: string;
		producerRequirementIds: readonly string[];
		productIds: readonly string[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

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

export const readRuntimeProducerProductLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerId,
	producerItemId,
	producerRequirementIds,
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
		producerId,
		producerItemId,
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

	return visibleProductIds.flatMap((productId) => {
		const product = config.products[productId];
		if (!product) return [];
		const lineKind = readProducerLineKind({
			product,
		});
		const isDefault =
			lineKind === "effect"
				? productId === selectedDefaultEffectProductId
				: productId === selectedDefaultProductId;

		const requirements = resolveGameRequirements({
			config,
			requirementIds: [
				...producerRequirementIds,
				...product.requirementIds,
			],
		});
		const requirementViews = readRuntimeActivationRequirementViewsFromGameSave({
			requirements,
			save,
			targetItemInstanceId,
		});
		const requirementItemIds = [
			...new Set(
				requirements.flatMap((requirement) =>
					requirement.type === "proximity"
						? requirement.itemIds.map((itemId) => itemId as ItemId)
						: [
								requirement.itemId as ItemId,
							],
				),
			),
		];
		const missingRequirements = readRuntimeMissingRequirementItemIdsFromGameSave({
			requirements,
			save,
			targetItemInstanceId,
		});
		const requirementsReady = readRuntimeRequirementsReadyFromGameSave({
			requirements,
			save,
			targetItemInstanceId,
		});
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
			producerItemInstanceId: targetItemInstanceId,
			requirements,
			save,
		});
		const effectiveProductLine = readEffectiveProducerProductLine({
			baseDurationMs,
			config,
			nowMs,
			producerId,
			producerItemId,
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

		const outputItemIds = [
			...new Set(
				readProductOutputItemIds({
					config,
					productId,
				}),
			),
		];

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

		return [
			{
				blocked: effectiveProductLine.blocked,
				effectLocked,
				blockReasonEffectIds: effectiveProductLine.blockReasons.map(
					(effect) => effect.effectId,
				),
				deliveryBlocked,
				durationMs,
				effectDurationMultiplier:
					effectiveProductLine.durationMs > baseDurationMs && baseDurationMs > 0
						? effectiveProductLine.durationMs / baseDurationMs
						: undefined,
				effectBenefits: product.activatesEffectId
					? readRuntimeEffectBenefitLines({
							config,
							effectId: product.activatesEffectId,
						})
					: undefined,
				effectBonusLines: effectBonusLines.length ? effectBonusLines : undefined,
				inProgress: jobs.length > 0,
				inputItemIds: inputs.map((input) => input.itemId as ItemId),
				isDefault,
				lineKind,
				inputs,
				inputsReady,
				inputsAvailable,
				missingRequirementItemIds: missingRequirements as ItemId[],
				name: product.name,
				outputs: outputItemIds.map((itemId) => ({
					itemId: itemId as ItemId,
					ownedQuantity: readGameSaveItemQuantityByScope({
						itemId,
						save,
						scope: "board_or_inventory",
					}),
				})),
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
				requirementItemIds,
				requirements: requirementViews,
				requirementsReady,
				startAtMs: activeJob?.startAtMs,
			},
		];
	});
};
