import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSave } from "~/v0/game/engine/logic/cloneGameSave";
import {
	placeGameSaveItems,
	type GameSaveItemPlacementRequest,
} from "~/v0/game/engine/logic/placeGameSaveItems";
import { processScheduledGameEvents } from "~/v0/game/engine/logic/processScheduledGameEvents";
import { rollLootTableItems } from "~/v0/game/engine/logic/rollLootTableItems";
import { scheduleGameItemSpawns } from "~/v0/game/engine/logic/scheduleGameItemSpawns";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type {
	GameSave,
	GameSaveCraftJob,
	GameSaveProducerJob,
} from "~/v0/game/engine/model/GameSaveSchema";

export namespace runGameTickFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const runGameTickFx = Effect.fn("runGameTickFx")(function* ({
	config,
	save,
	nowMs,
}: runGameTickFx.Props) {
	let nextSave = save;
	const events: GameEvent[] = [];

	const scheduledBeforeJobs = processScheduledGameEvents({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = scheduledBeforeJobs.save;
	events.push(...scheduledBeforeJobs.events);

	for (const job of readCompletedProducerJobs(nextSave, nowMs)) {
		const result = yield* completeProducerJobFx({
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

		const scheduledAfterJob = processScheduledGameEvents({
			config,
			nowMs,
			save: nextSave,
		});
		nextSave = scheduledAfterJob.save;
		events.push(...scheduledAfterJob.events);
	}

	for (const job of readCompletedCraftJobs(nextSave, nowMs)) {
		const result = yield* completeCraftJobFx({
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

		const scheduledAfterJob = processScheduledGameEvents({
			config,
			nowMs,
			save: nextSave,
		});
		nextSave = scheduledAfterJob.save;
		events.push(...scheduledAfterJob.events);
	}

	const scheduledAfterJobs = processScheduledGameEvents({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = scheduledAfterJobs.save;
	events.push(...scheduledAfterJobs.events);

	return {
		events,
		nextWakeAtMs: readNextWakeAtMs(nextSave),
		save: nextSave,
	} satisfies GameEngineResult;
});

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

const completeProducerJobFx = Effect.fn("completeProducerJobFx")(function* ({
	config,
	save,
	job,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	job: GameSaveProducerJob;
	nowMs: number;
}) {
	const liveJob = save.producerJobs[job.id];

	if (!liveJob) {
		return {
			events: [],
			save,
			type: "completed" as const,
		} satisfies CompletionResult;
	}

	const product = config.products[liveJob.productId];

	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${liveJob.productId}".`),
		);
	}

	if (!product.outputTableId) {
		const nextSave = cloneGameSave(save);
		delete nextSave.producerJobs[liveJob.id];
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					completedAtMs: nowMs,
					jobId: liveJob.id,
					producerItemInstanceId: liveJob.producerItemInstanceId,
					productId: liveJob.productId,
					type: "product.completed" as const,
				},
			],
			save: nextSave,
			type: "completed" as const,
		} satisfies CompletionResult;
	}

	const lootTable = config.lootTables[product.outputTableId];

	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing loot table "${product.outputTableId}".`,
			),
		);
	}

	const roll = rollLootTableItems(lootTable, save.rngSeed);
	const placementRequests = roll.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: liveJob.producerItemInstanceId,
				reason: "product-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
	const preflightPlacement = placeGameSaveItems({
		config,
		items: placementRequests,
		nowMs,
		save: {
			...save,
			rngSeed: roll.seed,
		},
	});

	if (preflightPlacement.type === "blocked") {
		return {
			event: {
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
				reason: "placement_unavailable" as const,
				type: "product.blocked" as const,
			},
			type: "blocked" as const,
		} satisfies CompletionResult;
	}

	const nextSave = cloneGameSave(save);
	nextSave.rngSeed = roll.seed;
	delete nextSave.producerJobs[liveJob.id];
	scheduleGameItemSpawns({
		dueAtMs: nowMs,
		items: placementRequests,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				completedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
				type: "product.completed" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies CompletionResult;
});

const completeCraftJobFx = Effect.fn("completeCraftJobFx")(function* ({
	config,
	save,
	job,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	job: GameSaveCraftJob;
	nowMs: number;
}) {
	const liveJob = save.craftJobs[job.id];

	if (!liveJob) {
		return {
			events: [],
			save,
			type: "completed" as const,
		} satisfies CompletionResult;
	}

	const recipe = config.craftRecipes[liveJob.recipeId];

	if (!recipe) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft recipe "${liveJob.recipeId}".`),
		);
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
	const preflightPlacement = placeGameSaveItems({
		config,
		items: placementRequests,
		nowMs,
		save,
	});

	if (preflightPlacement.type === "blocked") {
		return {
			event: {
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				reason: "placement_unavailable" as const,
				recipeId: liveJob.recipeId,
				type: "craft.blocked" as const,
			},
			type: "blocked" as const,
		} satisfies CompletionResult;
	}

	const nextSave = cloneGameSave(save);
	delete nextSave.craftJobs[liveJob.id];
	scheduleGameItemSpawns({
		dueAtMs: nowMs,
		items: placementRequests,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				completedAtMs: nowMs,
				jobId: liveJob.id,
				recipeId: liveJob.recipeId,
				type: "craft.completed" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies CompletionResult;
});

const readNextWakeAtMs = (save: GameSave): number | null => {
	const wakeTimes = [
		...Object.values(save.scheduledEvents).map((event) => event.dueAtMs),
		...Object.values(save.producerJobs).map((job) => job.completesAtMs),
		...Object.values(save.craftJobs).map((job) => job.completesAtMs),
	];

	if (wakeTimes.length === 0) {
		return null;
	}

	return Math.min(...wakeTimes);
};
