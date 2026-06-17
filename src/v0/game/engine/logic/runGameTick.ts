import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type {
	GameSave,
	GameSaveCraftJob,
	GameSaveProducerJob,
} from "~/v0/game/engine/model/GameSaveSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import { cloneGameSave } from "~/v0/game/engine/logic/cloneGameSave";
import {
	placeGameSaveItems,
	type GameSaveItemPlacementRequest,
} from "~/v0/game/engine/logic/placeGameSaveItems";
import { rollLootTableItems } from "~/v0/game/engine/logic/rollLootTableItems";

export interface RunGameTickInput {
	config: GameConfig;
	save: GameSave;
	nowMs: number;
}

export const runGameTick = ({ config, save, nowMs }: RunGameTickInput): GameEngineResult => {
	let nextSave = save;
	const events: GameEvent[] = [];

	for (const job of readCompletedProducerJobs(nextSave, nowMs)) {
		const result = completeProducerJob({
			config,
			job,
			nowMs,
			save: nextSave,
		});

		if (result.type === "blocked") {
			events.push(result.event);
			continue;
		}

		nextSave = result.save;
		events.push(...result.events);
	}

	for (const job of readCompletedCraftJobs(nextSave, nowMs)) {
		const result = completeCraftJob({
			config,
			job,
			nowMs,
			save: nextSave,
		});

		if (result.type === "blocked") {
			events.push(result.event);
			continue;
		}

		nextSave = result.save;
		events.push(...result.events);
	}

	return {
		save: nextSave,
		events,
	};
};

const readCompletedProducerJobs = (save: GameSave, nowMs: number) =>
	Object.values(save.producerJobs)
		.filter((job) => job.completesAtMs <= nowMs)
		.sort(compareTimedJobs);

const readCompletedCraftJobs = (save: GameSave, nowMs: number) =>
	Object.values(save.craftJobs)
		.filter((job) => job.completesAtMs <= nowMs)
		.sort(compareTimedJobs);

const compareTimedJobs = (
	left: Pick<GameSaveProducerJob | GameSaveCraftJob, "completesAtMs" | "id">,
	right: Pick<GameSaveProducerJob | GameSaveCraftJob, "completesAtMs" | "id">,
) => left.completesAtMs - right.completesAtMs || left.id.localeCompare(right.id);

type CompletionResult =
	| {
			type: "completed";
			save: GameSave;
			events: GameEvent[];
	  }
	| {
			type: "blocked";
			event: GameEvent;
	  };

const completeProducerJob = ({
	config,
	save,
	job,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	job: GameSaveProducerJob;
	nowMs: number;
}): CompletionResult => {
	const liveJob = save.producerJobs[job.id];

	if (!liveJob) {
		return {
			type: "completed" as const,
			save,
			events: [],
		};
	}

	const product = config.products[liveJob.productId];

	if (!product?.outputTableId) {
		const nextSave = cloneGameSave(save);
		delete nextSave.producerJobs[liveJob.id];
		nextSave.updatedAtMs = nowMs;

		return {
			type: "completed" as const,
			save: nextSave,
			events: [
				{
					type: "product.completed" as const,
					completedAtMs: nowMs,
					jobId: liveJob.id,
					producerItemInstanceId: liveJob.producerItemInstanceId,
					productId: liveJob.productId,
				},
			],
		};
	}

	const lootTable = config.lootTables[product.outputTableId];

	if (!lootTable) {
		return {
			type: "blocked" as const,
			event: {
				type: "product.blocked" as const,
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
				reason: "placement_unavailable" as const,
			},
		};
	}

	const roll = rollLootTableItems(lootTable, save.rngSeed);
	const placement = placeGameSaveItems({
		config,
		items: roll.items.map(
			(item) =>
				({
					...item,
					originItemInstanceId: liveJob.producerItemInstanceId,
					reason: "product-output",
				}) satisfies GameSaveItemPlacementRequest,
		),
		nowMs,
		save: {
			...save,
			rngSeed: roll.seed,
		},
	});

	if (placement.type === "blocked") {
		return {
			type: "blocked" as const,
			event: {
				type: "product.blocked" as const,
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
				reason: "placement_unavailable" as const,
			},
		};
	}

	delete placement.save.producerJobs[liveJob.id];
	placement.save.updatedAtMs = nowMs;

	return {
		type: "completed" as const,
		save: placement.save,
		events: [
			{
				type: "product.completed" as const,
				completedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
			},
			...placement.events,
		],
	};
};

const completeCraftJob = ({
	config,
	save,
	job,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	job: GameSaveCraftJob;
	nowMs: number;
}): CompletionResult => {
	const liveJob = save.craftJobs[job.id];

	if (!liveJob) {
		return {
			type: "completed" as const,
			save,
			events: [],
		};
	}

	const recipe = config.craftRecipes[liveJob.recipeId];

	if (!recipe) {
		return {
			type: "blocked" as const,
			event: {
				type: "craft.blocked" as const,
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				reason: "placement_unavailable" as const,
				recipeId: liveJob.recipeId,
			},
		};
	}

	const placementRequests: GameSaveItemPlacementRequest[] = [
		...liveJob.returnItems.map(
			(item) =>
				({
					...item,
					reason: "craft-requirement-return",
				}) satisfies GameSaveItemPlacementRequest,
		),
		{
			itemId: recipe.resultItemId,
			quantity: 1,
			reason: "craft-output",
		},
	];
	const placement = placeGameSaveItems({
		config,
		items: placementRequests,
		nowMs,
		save,
	});

	if (placement.type === "blocked") {
		return {
			type: "blocked" as const,
			event: {
				type: "craft.blocked" as const,
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				reason: "placement_unavailable" as const,
				recipeId: liveJob.recipeId,
			},
		};
	}

	delete placement.save.craftJobs[liveJob.id];
	placement.save.updatedAtMs = nowMs;

	return {
		type: "completed" as const,
		save: placement.save,
		events: [
			{
				type: "craft.completed" as const,
				completedAtMs: nowMs,
				jobId: liveJob.id,
				recipeId: liveJob.recipeId,
			},
			...placement.events,
		],
	};
};
