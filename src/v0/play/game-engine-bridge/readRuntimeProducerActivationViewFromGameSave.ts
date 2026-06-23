import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readRuntimeActivationHindranceViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationHindranceViewsFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
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
	producerRequirementIds,
	productIds,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	maxQueueSize: number;
	nowMs: number;
	producerHinderedBy: NonNullable<GameConfig["producers"][string]["hinderedBy"]>;
	producerRequirementIds: GameConfig["producers"][string]["requirementIds"];
	productIds: readonly string[];
	save: GameSave;
	targetItemInstanceId: string;
}): ProducerProductLineView[] => {
	const producerQueuedJobs = Object.values(save.producerJobs).filter(
		(job) => job.producerItemInstanceId === targetItemInstanceId,
	).length;
	const queueFull = producerQueuedJobs >= maxQueueSize;
	const selectedDefaultProductId = readProducerDefaultProductId({
		productIds,
		producerItemInstanceId: targetItemInstanceId,
		save,
	});

	return productIds.flatMap((productId) => {
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
		const jobs = Object.values(save.producerJobs)
			.filter(
				(job) =>
					job.producerItemInstanceId === targetItemInstanceId &&
					job.productId === productId,
			)
			.sort(
				(left, right) =>
					left.startedAtMs - right.startedAtMs || left.id.localeCompare(right.id),
			);
		const activeJob = jobs.find((job) => job.completesAtMs > nowMs) ?? jobs[0];
		const durationMs = activeJob
			? activeJob.completesAtMs - activeJob.startedAtMs
			: readProducerProductDurationMs({
					hindrances,
					product,
					producerItemInstanceId: targetItemInstanceId,
					requirements,
					save,
				});
		const progress = activeJob
			? Math.max(
					0,
					Math.min(
						1,
						(nowMs - activeJob.startedAtMs) /
							Math.max(1, activeJob.completesAtMs - activeJob.startedAtMs),
					),
				)
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
				outputTableId: product.outputTableId,
				productId,
				producerQueuedJobs,
				progress,
				queueFull,
				queueSize: maxQueueSize,
				queuedJobs: jobs.length,
				readyAtMs: activeJob?.completesAtMs,
				requirementItemIds,
				requirements: requirementViews,
				requirementsReady,
				startedAtMs: activeJob?.startedAtMs,
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

	const selectedProductId = readProducerDefaultProductId({
		productIds: producer.productIds,
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
