import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameEvent } from "~/event/GameEventSchema";
import { processItemSpawnJobFx } from "~/job/processItemSpawnJobFx";
import { readDueItemSpawnJobsFx } from "~/job/readDueItemSpawnJobsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import type { GameSave, GameSaveItemSpawnJob } from "~/engine/model/GameSaveSchema";
import { isItemSpawnJobWaitingForDependencies } from "~/world/isItemSpawnJobWaitingForDependencies";

export const blockedItemSpawnJobRetryDelayMs = 1000;

export namespace processItemSpawnJobsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

type DueItemSpawnJob = Extract<
	GameSaveItemSpawnJob,
	{
		type: "item.spawn";
	}
>;

type ItemSpawnJobsProcessingState = {
	events: GameEvent[];
	nextSave: GameSave;
	processedExclusiveGroupKeys: Set<string>;
};

class ItemSpawnJobsProcessingScopeFx extends Context.Tag("ItemSpawnJobsProcessingScopeFx")<
	ItemSpawnJobsProcessingScopeFx,
	processItemSpawnJobsFx.Props
>() {
	//
}

const createItemSpawnJobsProcessingStateFx = Effect.fn(
	"processItemSpawnJobsFx.createItemSpawnJobsProcessingStateFx",
)(function* () {
	const { save } = yield* ItemSpawnJobsProcessingScopeFx;
	return {
		events: [] as GameEvent[],
		nextSave: yield* cloneGameSaveFx({
			save,
		}),
		processedExclusiveGroupKeys: new Set<string>(),
	} satisfies ItemSpawnJobsProcessingState;
});

const readDueItemSpawnJobBatchFx = Effect.fn("processItemSpawnJobsFx.readDueItemSpawnJobBatchFx")(
	function* () {
		const { nowMs, save } = yield* ItemSpawnJobsProcessingScopeFx;
		return yield* readDueItemSpawnJobsFx({
			nowMs,
			save,
		});
	},
);

const readItemSpawnJobSkippedFx = Effect.fn("processItemSpawnJobsFx.readItemSpawnJobSkippedFx")(
	function* ({ job, state }: { job: DueItemSpawnJob; state: ItemSpawnJobsProcessingState }) {
		if (job.exclusiveGroupKey && state.processedExclusiveGroupKeys.has(job.exclusiveGroupKey)) {
			return true;
		}
		return isItemSpawnJobWaitingForDependencies({
			job,
			save: state.nextSave,
		});
	},
);

const rememberProcessedExclusiveGroupFx = Effect.fn(
	"processItemSpawnJobsFx.rememberProcessedExclusiveGroupFx",
)(function* ({ job, state }: { job: DueItemSpawnJob; state: ItemSpawnJobsProcessingState }) {
	if (!job.exclusiveGroupKey) return;
	state.processedExclusiveGroupKeys.add(job.exclusiveGroupKey);
});

const markBlockedItemSpawnJobForRetryFx = Effect.fn(
	"processItemSpawnJobsFx.markBlockedItemSpawnJobForRetryFx",
)(function* ({ job, state }: { job: DueItemSpawnJob; state: ItemSpawnJobsProcessingState }) {
	const { nowMs } = yield* ItemSpawnJobsProcessingScopeFx;
	state.nextSave.itemSpawnJobs[job.id] = {
		...job,
		readyAtMs: nowMs + blockedItemSpawnJobRetryDelayMs,
		lastBlockedAtMs: nowMs,
	};
	state.nextSave.updatedAtMs = nowMs;
});

const applyBlockedItemSpawnJobResultFx = Effect.fn(
	"processItemSpawnJobsFx.applyBlockedItemSpawnJobResultFx",
)(function* ({
	job,
	result,
	state,
}: {
	job: DueItemSpawnJob;
	result: Extract<
		GameEngineCompletionResult,
		{
			type: "blocked";
		}
	>;
	state: ItemSpawnJobsProcessingState;
}) {
	yield* markBlockedItemSpawnJobForRetryFx({
		job,
		state,
	});
	if (job.lastBlockedAtMs === undefined) {
		state.events.push(...result.events);
	}
});

const applyCompletedItemSpawnJobResultFx = Effect.fn(
	"processItemSpawnJobsFx.applyCompletedItemSpawnJobResultFx",
)(function* ({
	result,
	state,
}: {
	result: Extract<
		GameEngineCompletionResult,
		{
			type: "completed";
		}
	>;
	state: ItemSpawnJobsProcessingState;
}) {
	state.nextSave = result.save;
	state.events.push(...result.events);
});

const applyItemSpawnJobResultFx = Effect.fn("processItemSpawnJobsFx.applyItemSpawnJobResultFx")(
	function* ({
		job,
		result,
		state,
	}: {
		job: DueItemSpawnJob;
		result: GameEngineCompletionResult;
		state: ItemSpawnJobsProcessingState;
	}) {
		return yield* match(result)
			.with(
				{
					type: "blocked",
				},
				(blockedResult) =>
					applyBlockedItemSpawnJobResultFx({
						job,
						result: blockedResult,
						state,
					}),
			)
			.with(
				{
					type: "completed",
				},
				(completedResult) =>
					applyCompletedItemSpawnJobResultFx({
						result: completedResult,
						state,
					}),
			)
			.exhaustive();
	},
);

const processDueItemSpawnJobFx = Effect.fn("processItemSpawnJobsFx.processDueItemSpawnJobFx")(
	function* ({ job, state }: { job: DueItemSpawnJob; state: ItemSpawnJobsProcessingState }) {
		if (
			yield* readItemSpawnJobSkippedFx({
				job,
				state,
			})
		) {
			return;
		}

		const { config, nowMs } = yield* ItemSpawnJobsProcessingScopeFx;
		const result = yield* processItemSpawnJobFx({
			config,
			nowMs,
			save: state.nextSave,
			itemSpawnJob: job,
		});

		yield* rememberProcessedExclusiveGroupFx({
			job,
			state,
		});
		yield* applyItemSpawnJobResultFx({
			job,
			result,
			state,
		});
	},
);

const processDueItemSpawnJobsFx = Effect.fn("processItemSpawnJobsFx.processDueItemSpawnJobsFx")(
	function* ({ dueJobs }: { dueJobs: DueItemSpawnJob[] }) {
		const state = yield* createItemSpawnJobsProcessingStateFx();
		for (const job of dueJobs) {
			yield* processDueItemSpawnJobFx({
				job,
				state,
			});
		}
		return {
			events: state.events,
			save: state.nextSave,
		};
	},
);

const processItemSpawnJobsProgramFx = Effect.fn("processItemSpawnJobsFx.programFx")(function* () {
	const { save } = yield* ItemSpawnJobsProcessingScopeFx;
	const dueJobs = yield* readDueItemSpawnJobBatchFx();
	if (dueJobs.length === 0) {
		return {
			events: [] as GameEvent[],
			save,
		};
	}
	return yield* processDueItemSpawnJobsFx({
		dueJobs,
	});
});

export const processItemSpawnJobsFx = Effect.fn("processItemSpawnJobsFx")(function* (
	props: processItemSpawnJobsFx.Props,
) {
	return yield* processItemSpawnJobsProgramFx().pipe(
		Effect.provideService(ItemSpawnJobsProcessingScopeFx, props),
	);
});
