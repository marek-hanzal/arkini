import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import { readProductOutputItemIds } from "~/v0/game/config/readProductOutputItemIds";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readRuntimeActivationHindranceViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationHindranceViewsFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readFirstProducerQueueJobs } from "~/v0/game/producer/readFirstProducerQueueJobs";
import { readGameTimeDurationMs, readGameTimeProgress } from "~/v0/game/time/GameTime";
import {
	readRuntimeActivationRequirementViewsFromGameSave,
	readRuntimeMissingRequirementItemIdsFromGameSave,
	readRuntimeRequirementsReadyFromGameSave,
} from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";

export namespace readRuntimeProducerActivationViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
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

const readRuntimeProductLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerHinderedBy,
	producerId,
	producerItemId,
	producerRequirementIds,
	productIds,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	maxQueueSize: number;
	nowMs: number;
	producerHinderedBy: NonNullable<GameConfig["producers"][string]["hinderedBy"]>;
	producerId: string;
	producerItemId: string;
	producerRequirementIds: GameConfig["producers"][string]["requirementIds"];
	productIds: readonly string[];
	save: GameSave;
	targetItemInstanceId: string;
}): ProducerProductLineView[] => {
	const producerJobs = Object.values(save.producerJobs).filter(
		(job) => job.producerItemInstanceId === targetItemInstanceId,
	);
	const producerQueuedJobs = producerJobs.length;
	const firstProducerJob = readFirstProducerQueueJobs(save).find(
		(job) => job.producerItemInstanceId === targetItemInstanceId,
	);
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

	return visibleProductIds.flatMap((productId) => {
		const product = config.products[productId];
		if (!product) return [];
		const isDefault = productId === selectedDefaultProductId;

		const requirements = resolveGameRequirements({
			config,
			requirementIds: [
				...producerRequirementIds,
				...product.requirementIds,
			],
		});
		const hindrances = [
			...producerHinderedBy,
			...(product.hinderedBy ?? []),
		];
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
		const jobs = producerJobs
			.filter((job) => job.productId === productId)
			.sort(
				(left, right) =>
					left.startAtMs - right.startAtMs || left.id.localeCompare(right.id),
			);
		const activeJob = firstProducerJob?.productId === productId ? firstProducerJob : undefined;
		const baseDurationMs = readProducerProductDurationMs({
			hindrances,
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
		const progress = activeJob
			? readGameTimeProgress({
					nowMs,
					readyAtMs: activeJob.readyAtMs,
					startAtMs: activeJob.startAtMs,
				})
			: undefined;

		const inputs = readProductInputs({
			config,
			productId,
		}).map((input) =>
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
		const inputsReady = inputs.every((input) => input.stored >= input.quantity);
		const inputsAvailable = inputs.every(
			(input) =>
				input.stored +
					readRuntimeActivationInputAvailableQuantityFromGameSave({
						itemId: input.itemId,
						save,
						targetItemInstanceId,
					}) >=
				input.quantity,
		);

		return [
			{
				blocked: effectiveProductLine.blocked,
				blockReasonEffectIds: effectiveProductLine.blockReasons.map(
					(effect) => effect.effectId,
				),
				durationMs,
				inProgress: jobs.length > 0,
				hindrances: readRuntimeActivationHindranceViewsFromGameSave({
					hindrances,
					save,
					targetItemInstanceId,
				}),
				inputItemIds: inputs.map((input) => input.itemId as ItemId),
				isDefault,
				inputs,
				inputsReady,
				inputsAvailable,
				missingRequirementItemIds: missingRequirements as ItemId[],
				name: product.name,
				outputItemIds: readProductOutputItemIds({
					config,
					productId,
				}),
				productId,
				producerQueuedJobs,
				progress,
				queueFull,
				queueSize: maxQueueSize,
				queuedJobs: jobs.length,
				readyAtMs: activeJob?.readyAtMs,
				requirementItemIds,
				requirements: requirementViews,
				requirementsReady,
				startAtMs: activeJob?.startAtMs,
			},
		];
	});
};

export const readRuntimeProducerActivationViewFromGameSave = ({
	boardItem,
	config,
	nowMs,
	save,
}: readRuntimeProducerActivationViewFromGameSave.Props): ActivationView | undefined => {
	const item = config.items[boardItem.itemId];
	const producerId = item?.producerId;
	const producer = producerId ? config.producers[producerId] : undefined;
	if (!producerId || !producer) return undefined;

	const visibleProductIds = readVisibleProducerProductIds({
		config,
		nowMs,
		producerId,
		producerItemId: boardItem.itemId,
		producerItemInstanceId: boardItem.id,
		productIds: producer.productIds,
		save,
	});
	const selectedProductId = readProducerDefaultProductId({
		productIds: visibleProductIds,
		producerItemInstanceId: boardItem.id,
		save,
	});
	const selectedProduct = selectedProductId ? config.products[selectedProductId] : undefined;

	const deliveryBlocked = Object.values(save.producerJobs).some(
		(job) =>
			job.producerItemInstanceId === boardItem.id &&
			job.delivery?.lastBlockedAtMs !== undefined,
	);

	return {
		deliveryBlocked,
		inputs: [],
		kind: "producer",
		productLines: readRuntimeProductLineViewsFromGameSave({
			config,
			maxQueueSize: producer.maxQueueSize,
			nowMs,
			producerHinderedBy: producer.hinderedBy ?? [],
			producerId,
			producerItemId: boardItem.itemId,
			producerRequirementIds: producer.requirementIds,
			productIds: producer.productIds,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		requirements: readRuntimeActivationRequirementViewsFromGameSave({
			requirements: resolveGameRequirements({
				config,
				requirementIds: [
					...producer.requirementIds,
					...(selectedProduct?.requirementIds ?? []),
				],
			}),
			save,
			targetItemInstanceId: boardItem.id,
		}),
		trigger: "click",
	};
};
