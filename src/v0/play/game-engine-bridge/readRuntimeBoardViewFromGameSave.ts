import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";

export namespace readRuntimeBoardViewFromGameSave {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const storedQuantity = ({
	itemId,
	save,
	targetItemInstanceId,
}: {
	itemId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => save.storedRequirements[targetItemInstanceId]?.items[itemId] ?? 0;

const storedProductInputQuantity = ({
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

const inputView = ({
	input,
	stored,
}: {
	input: {
		itemId: string;
		quantity: number;
		capacity: number;
		consume: boolean;
	};
	stored: number;
}): ActivationInputView => ({
	capacity: input.capacity,
	consume: input.consume,
	itemId: input.itemId as ItemId,
	quantity: input.quantity,
	stored,
});

const storedRequirementView = ({
	requirement,
	save,
	targetItemInstanceId,
}: {
	requirement: {
		capacity: number;
		itemId: string;
		quantity: number;
	};
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationRequirementView => ({
	capacity: requirement.capacity,
	type: "stored",
	itemId: requirement.itemId as ItemId,
	quantity: requirement.quantity,
	stored: storedQuantity({
		itemId: requirement.itemId as ItemId,
		save,
		targetItemInstanceId,
	}),
});

const passiveRequirementView = ({
	requirement,
}: {
	requirement: {
		itemId: string;
		quantity: number;
	};
}): ActivationRequirementView => ({
	capacity: requirement.quantity,
	type: "passive",
	itemId: requirement.itemId as ItemId,
	quantity: requirement.quantity,
	stored: 0,
});

const activationRequirements = ({
	requirements,
	save,
	targetItemInstanceId,
}: {
	requirements: readonly (
		| {
				capacity: number;
				itemId: string;
				quantity: number;
				type: "stored";
		  }
		| {
				itemId: string;
				quantity: number;
				type: "passive";
		  }
	)[];
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationRequirementView[] =>
	requirements.map((requirement) =>
		requirement.type === "stored"
			? storedRequirementView({
					requirement,
					save,
					targetItemInstanceId,
				})
			: passiveRequirementView({
					requirement,
				}),
	);

const productLineEnabled = ({
	productId,
	save,
	targetItemInstanceId,
}: {
	productId: string;
	save: GameSave;
	targetItemInstanceId: string;
}) => !(save.producerLines[targetItemInstanceId]?.disabledProductIds ?? []).includes(productId);

const passiveItemQuantity = ({
	itemId,
	save,
	scope,
}: {
	itemId: string;
	save: GameSave;
	scope: "board" | "inventory" | "board_or_inventory";
}) => {
	let quantity = 0;

	if (scope === "board" || scope === "board_or_inventory") {
		quantity += Object.values(save.board.items).filter((item) => item.itemId === itemId).length;
	}

	if (scope === "inventory" || scope === "board_or_inventory") {
		quantity += save.inventory.slots.reduce(
			(total, slot) => total + (slot?.itemId === itemId ? slot.quantity : 0),
			0,
		);
	}

	return quantity;
};

const missingRequirementItemIds = ({
	requirements,
	save,
	targetItemInstanceId,
}: {
	requirements: readonly (
		| {
				itemId: string;
				quantity: number;
				type: "stored";
		  }
		| {
				itemId: string;
				quantity: number;
				scope: "board" | "inventory" | "board_or_inventory";
				type: "passive";
		  }
	)[];
	save: GameSave;
	targetItemInstanceId: string;
}) => [
	...new Set(
		requirements.flatMap((requirement) => {
			if (requirement.type === "stored") {
				return storedQuantity({
					itemId: requirement.itemId,
					save,
					targetItemInstanceId,
				}) >= requirement.quantity
					? []
					: [
							requirement.itemId,
						];
			}

			return passiveItemQuantity({
				itemId: requirement.itemId,
				save,
				scope: requirement.scope,
			}) >= requirement.quantity
				? []
				: [
						requirement.itemId,
					];
		}),
	),
];

const readProductLineViews = ({
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
		const missingRequirements = missingRequirementItemIds({
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
			inputView({
				input,
				stored: storedProductInputQuantity({
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
				inputs,
				inputsReady,
				inputItemIds: inputs.map((input) => input.itemId as ItemId),
				name: product.name,
				outputTableId: product.outputTableId,
				productId,
				producerQueuedJobs,
				progress,
				queueFull,
				queueSize: maxQueueSize,
				queuedJobs: jobs.length,
				requirementsReady: missingRequirements.length === 0,
				missingRequirementItemIds: missingRequirements as ItemId[],
				readyAtMs: activeJob?.completesAtMs,
				requirementItemIds,
				startedAtMs: activeJob?.startedAtMs,
			},
		];
	});
};

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

const readRuntimeActivationView = ({
	boardItem,
	config,
	nowMs,
	save,
}: {
	boardItem: GameSaveBoardItem;
	config: GameConfig;
	nowMs: number;
	save: GameSave;
}): ActivationView | undefined => {
	const item = config.items[boardItem.itemId];
	if (!item) return undefined;

	if (item.stashId) {
		const stash = config.stashes[item.stashId];
		if (!stash) return undefined;

		return {
			inputs: stash.inputs.map((input) =>
				inputView({
					input,
					stored: 0,
				}),
			),
			kind: "stash",
			remainingCharges: save.stashes[boardItem.id]?.remainingCharges ?? stash.charges,
			requirements: activationRequirements({
				requirements: stash.requirements,
				save,
				targetItemInstanceId: boardItem.id,
			}),
			trigger: "click",
		};
	}

	if (item.producerId) {
		const producer = config.producers[item.producerId];
		if (!producer) return undefined;
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
			productLines: readProductLineViews({
				config,
				maxQueueSize: producer.maxQueueSize,
				nowMs,
				producerRequirements: producer.requirements,
				productIds: producer.productIds,
				save,
				targetItemInstanceId: boardItem.id,
			}),
			requirements: [
				...activationRequirements({
					requirements: producer.requirements,
					save,
					targetItemInstanceId: boardItem.id,
				}),
				...(selectedProduct
					? activationRequirements({
							requirements: selectedProduct.requirements,
							save,
							targetItemInstanceId: boardItem.id,
						})
					: []),
			],
			trigger: "click",
		};
	}

	return undefined;
};

const readRuntimeCraftView = ({
	boardItem,
	config,
	nowMs,
	save,
}: {
	boardItem: GameSaveBoardItem;
	config: GameConfig;
	nowMs: number;
	save: GameSave;
}): CraftProgressView | undefined => {
	const recipeId = config.items[boardItem.itemId]?.craftRecipeId;
	if (!recipeId) return undefined;
	const recipe = config.craftRecipes[recipeId];
	if (!recipe) return undefined;

	const runningJob = Object.values(save.craftJobs).find(
		(job) => job.recipeId === recipeId && job.targetItemInstanceId === boardItem.id,
	);
	const delivered = save.craftInputs[boardItem.id]?.items ?? {};
	const totalInputQuantity = recipe.inputs.reduce((total, input) => total + input.quantity, 0);
	const deliveredInputQuantity = recipe.inputs.reduce(
		(total, input) => total + Math.min(input.quantity, delivered[input.itemId] ?? 0),
		0,
	);
	const inputProgress =
		totalInputQuantity === 0 ? 1 : deliveredInputQuantity / totalInputQuantity;
	const startedAtMs = runningJob?.startedAtMs;
	const readyAtMs = runningJob?.completesAtMs;
	const timeProgress =
		startedAtMs !== undefined && readyAtMs !== undefined
			? Math.max(0, Math.min(1, (nowMs - startedAtMs) / Math.max(1, readyAtMs - startedAtMs)))
			: 0;
	const phase =
		readyAtMs !== undefined && readyAtMs <= nowMs
			? "ready"
			: readyAtMs !== undefined
				? "waiting"
				: "collecting_inputs";
	const acceptedInputItemIds =
		phase === "collecting_inputs"
			? recipe.inputs.flatMap((input) =>
					(delivered[input.itemId] ?? 0) < input.quantity
						? [
								input.itemId as ItemId,
							]
						: [],
				)
			: [];

	return {
		acceptedInputItemIds,
		canAcceptInputs: acceptedInputItemIds.length > 0,
		complete: phase === "ready",
		delivered,
		requirements: activationRequirements({
			requirements: recipe.requirements,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		durationMs: recipe.durationMs,
		id: recipeId,
		inputProgress,
		inputs: recipe.inputs.map((input) => ({
			itemId: input.itemId as ItemId,
			quantity: input.quantity,
		})),
		phase,
		progress: phase === "collecting_inputs" ? inputProgress : timeProgress,
		readyAtMs,
		remainingMs: readyAtMs !== undefined ? Math.max(0, readyAtMs - nowMs) : undefined,
		resultItemId: recipe.resultItemId as ItemId,
		startedAtMs,
		timeProgress,
	};
};

export const readRuntimeBoardViewFromGameSave = ({
	config,
	nowMs,
	save,
}: readRuntimeBoardViewFromGameSave.Props): BoardView => {
	const items = Object.values(save.board.items)
		.sort(
			(left, right) =>
				left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
		)
		.map(
			(boardItem): BoardViewItem => ({
				activation: readRuntimeActivationView({
					boardItem,
					config,
					nowMs,
					save,
				}),
				craft: readRuntimeCraftView({
					boardItem,
					config,
					nowMs,
					save,
				}),
				id: boardItem.id,
				itemId: boardItem.itemId as ItemId,
				state: {},
				x: boardItem.x,
				y: boardItem.y,
			}),
		);

	return rebuildBoardView(items);
};
