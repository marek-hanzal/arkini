import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import {
	readRuntimeActivationRequirementViewsFromGameSave,
	readRuntimeMissingRequirementItemIdsFromGameSave,
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

const productLineEnabled = ({
	productId,
	save,
	targetItemInstanceId,
}: {
	productId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => !(save.producerLines[targetItemInstanceId]?.disabledProductIds ?? []).includes(productId);

const activeProductId = ({
	productIds,
	save,
	targetItemInstanceId,
}: {
	productIds: readonly string[];
	save: GameSave;
	targetItemInstanceId: string;
}) =>
	productIds.find((productId) =>
		productLineEnabled({
			productId,
			save,
			targetItemInstanceId,
		}),
	) ?? productIds[0];

const readRuntimeProductLineViewsFromGameSave = ({
	config,
	maxQueueSize,
	nowMs,
	producerRequirements,
	productIds,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	maxQueueSize: number;
	nowMs: number;
	producerRequirements: GameConfig["producers"][string]["requirements"];
	productIds: readonly string[];
	save: GameSave;
	targetItemInstanceId: string;
}): ProducerProductLineView[] => {
	const producerQueuedJobs = Object.values(save.producerJobs).filter(
		(job) => job.producerItemInstanceId === targetItemInstanceId,
	).length;
	const queueFull = producerQueuedJobs >= maxQueueSize;

	return productIds.flatMap((productId) => {
		const product = config.products[productId];
		if (!product) return [];

		const requirements = [
			...producerRequirements,
			...product.requirements,
		];
		const requirementItemIds = [
			...new Set(requirements.map((requirement) => requirement.itemId as ItemId)),
		];
		const missingRequirements = readRuntimeMissingRequirementItemIdsFromGameSave({
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

		return [
			{
				durationMs: product.durationMs,
				enabled: productLineEnabled({
					productId,
					save,
					targetItemInstanceId,
				}),
				inProgress: jobs.length > 0,
				inputItemIds: inputs.map((input) => input.itemId as ItemId),
				inputs,
				inputsReady,
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
				requirementsReady: missingRequirements.length === 0,
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

	const selectedProductId = activeProductId({
		productIds: producer.productIds,
		save,
		targetItemInstanceId: boardItem.id,
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
			producerRequirements: producer.requirements,
			productIds: producer.productIds,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		requirements: [
			...readRuntimeActivationRequirementViewsFromGameSave({
				requirements: producer.requirements,
				save,
				targetItemInstanceId: boardItem.id,
			}),
			...(selectedProduct
				? readRuntimeActivationRequirementViewsFromGameSave({
						requirements: selectedProduct.requirements,
						save,
						targetItemInstanceId: boardItem.id,
					})
				: []),
		],
		trigger: "click",
	};
};
