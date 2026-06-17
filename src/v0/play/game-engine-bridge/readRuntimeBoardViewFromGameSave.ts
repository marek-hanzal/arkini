import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
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

const inputView = ({
	input,
	save,
	targetItemInstanceId,
}: {
	input: {
		itemId: string;
		quantity: number;
		capacity: number;
	};
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationInputView => ({
	capacity: input.capacity,
	itemId: input.itemId as ItemId,
	quantity: input.quantity,
	stored: storedQuantity({
		itemId: input.itemId as ItemId,
		save,
		targetItemInstanceId,
	}),
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

const readProductLineViews = ({
	config,
	nowMs,
	productIds,
	save,
	targetItemInstanceId,
}: {
	config: GameConfig;
	nowMs: number;
	productIds: readonly string[];
	save: GameSave;
	targetItemInstanceId: string;
}): ProducerProductLineView[] =>
	productIds.flatMap((productId) => {
		const product = config.products[productId];
		if (!product) return [];

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

		return [
			{
				durationMs: product.durationMs,
				enabled: productLineEnabled({
					productId,
					save,
					targetItemInstanceId,
				}),
				inProgress: jobs.length > 0,
				inputItemIds: product.inputs.map((input) => input.itemId as ItemId),
				name: product.name,
				outputTableId: product.outputTableId,
				productId,
				progress,
				queuedJobs: jobs.length,
				readyAtMs: activeJob?.completesAtMs,
				requirementItemIds: product.requirements.map(
					(requirement) => requirement.itemId as ItemId,
				),
				startedAtMs: activeJob?.startedAtMs,
			},
		];
	});

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
					save,
					targetItemInstanceId: boardItem.id,
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

		return {
			inputs:
				selectedProduct?.inputs.map((input) =>
					inputView({
						input,
						save,
						targetItemInstanceId: boardItem.id,
					}),
				) ?? [],
			kind: "producer",
			productLines: readProductLineViews({
				config,
				nowMs,
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
	const startedAtMs = runningJob?.startedAtMs;
	const readyAtMs = runningJob?.completesAtMs;
	const timeProgress =
		startedAtMs !== undefined && readyAtMs !== undefined
			? Math.max(0, Math.min(1, (nowMs - startedAtMs) / Math.max(1, readyAtMs - startedAtMs)))
			: recipe.durationMs === 0
				? 1
				: 0;
	const phase =
		readyAtMs !== undefined && readyAtMs <= nowMs
			? "ready"
			: readyAtMs !== undefined
				? "waiting"
				: recipe.durationMs === 0
					? "ready"
					: "collecting_inputs";

	return {
		acceptedInputItemIds:
			phase === "collecting_inputs"
				? recipe.inputs.map((input) => input.itemId as ItemId)
				: [],
		canAcceptInputs: phase === "collecting_inputs",
		complete: phase === "ready",
		delivered: {},
		durationMs: recipe.durationMs,
		id: recipeId,
		inputProgress: phase === "collecting_inputs" ? 0 : 1,
		inputs: recipe.inputs.map((input) => ({
			itemId: input.itemId as ItemId,
			quantity: input.quantity,
		})),
		phase,
		progress: phase === "collecting_inputs" ? 0 : timeProgress,
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
