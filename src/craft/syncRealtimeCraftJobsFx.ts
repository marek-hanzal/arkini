import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import { readCraftJobEffectiveTimingFx } from "~/craft/readCraftJobEffectiveTimingFx";
import {
	isGamePausableJobPaused,
	readGamePausableJobRemainingMsAtPause,
	readGamePausableJobResumedTiming,
} from "~/job/GamePausableJobTiming";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	readCraftRecipeDefinition,
	type GameCraftRecipeDefinition,
} from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import {
	ensureGameSaveDraftFx,
	provideGameSaveDraftScopeFx,
	readGameSaveDraftCurrentFx,
	readUpdatedGameSaveDraftResultFx,
} from "~/save/GameSaveDraftScopeFx";

export namespace syncRealtimeCraftJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

class CraftRealtimeSyncScopeFx extends Context.Tag("CraftRealtimeSyncScopeFx")<
	CraftRealtimeSyncScopeFx,
	Pick<syncRealtimeCraftJobsFx.Props, "config" | "nowMs">
>() {
	//
}

const readSortedCraftJobsFx = Effect.fn("syncRealtimeCraftJobsFx.readSortedCraftJobsFx")(
	function* () {
		const save = yield* readGameSaveDraftCurrentFx();
		return Object.values(save.craftJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs || left.id.localeCompare(right.id),
		);
	},
);

const readCraftJobRecipeFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftJobRecipeFx")(function* ({
	job,
}: {
	job: GameSaveCraftJob;
}) {
	const { config } = yield* CraftRealtimeSyncScopeFx;
	const recipe = readCraftRecipeDefinition({
		config,
		recipeId: job.recipeId,
	});
	if (recipe) return recipe;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing craft recipe "${job.recipeId}".`),
	);
});

const readCraftStartGateReadyFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftStartGateReadyFx")(
	function* ({ recipe }: { recipe: GameCraftRecipeDefinition }) {
		const { config, nowMs } = yield* CraftRealtimeSyncScopeFx;
		const save = yield* readGameSaveDraftCurrentFx();
		return readCraftLineEffectState({
			config,
			nowMs,
			recipe,
			save,
		}).startGateReady;
	},
);

const readCraftJobSyncStateFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftJobSyncStateFx")(
	function* ({ job, recipe }: { job: GameSaveCraftJob; recipe: GameCraftRecipeDefinition }) {
		const { nowMs } = yield* CraftRealtimeSyncScopeFx;
		const startGateReady = yield* readCraftStartGateReadyFx({
			recipe,
		});

		if (isGamePausableJobPaused(job)) {
			return startGateReady ? "resumable" : "still_paused";
		}

		return !startGateReady && job.startAtMs <= nowMs ? "blocked" : "ready";
	},
);

const readCraftTargetExistsFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftTargetExistsFx")(
	function* ({ job }: { job: GameSaveCraftJob }) {
		const save = yield* readGameSaveDraftCurrentFx();
		return Boolean(save.board.items[job.targetItemInstanceId]);
	},
);

const resumePausedCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.resumePausedCraftJobFx")(
	function* ({ job, recipe }: { job: GameSaveCraftJob; recipe: GameCraftRecipeDefinition }) {
		const { nowMs } = yield* CraftRealtimeSyncScopeFx;
		const save = yield* readGameSaveDraftCurrentFx();
		const remainingMs = job.remainingMs ?? 0;
		const effectiveTiming = yield* readCraftJobEffectiveTimingFx({
			recipe,
			save,
			startAtMs: nowMs,
			targetItemInstanceId: job.targetItemInstanceId,
		});
		const durationMs = Math.max(0, effectiveTiming.readyAtMs - effectiveTiming.startAtMs);
		const resumedTiming = readGamePausableJobResumedTiming({
			durationMs,
			nowMs,
			remainingMs,
		});

		const draft = yield* ensureGameSaveDraftFx();
		const liveJob = draft.craftJobs[job.id];
		if (!liveJob) return;

		draft.craftJobs[job.id] = {
			...liveJob,
			pausedAtMs: undefined,
			readyAtMs: resumedTiming.readyAtMs,
			remainingMs: undefined,
			startAtMs: resumedTiming.startAtMs,
		};
	},
);

const pauseBlockedCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.pauseBlockedCraftJobFx")(
	function* ({ job }: { job: GameSaveCraftJob }) {
		const { nowMs } = yield* CraftRealtimeSyncScopeFx;
		const remainingMs = readGamePausableJobRemainingMsAtPause({
			job,
			nowMs,
		});
		const draft = yield* ensureGameSaveDraftFx();
		const liveJob = draft.craftJobs[job.id];
		if (!liveJob) return;

		draft.craftJobs[job.id] = {
			...liveJob,
			pausedAtMs: nowMs,
			readyAtMs: nowMs + remainingMs,
			remainingMs,
			startAtMs: job.startAtMs,
		};
	},
);

const retimeReadyCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.retimeReadyCraftJobFx")(
	function* ({ job, recipe }: { job: GameSaveCraftJob; recipe: GameCraftRecipeDefinition }) {
		const save = yield* readGameSaveDraftCurrentFx();
		const timing = yield* readCraftJobEffectiveTimingFx({
			recipe,
			save,
			startAtMs: job.startAtMs,
			targetItemInstanceId: job.targetItemInstanceId,
		});

		if (job.startAtMs === timing.startAtMs && job.readyAtMs === timing.readyAtMs) return;

		const draft = yield* ensureGameSaveDraftFx();
		const liveJob = draft.craftJobs[job.id];
		if (!liveJob) return;

		draft.craftJobs[job.id] = {
			...liveJob,
			readyAtMs: timing.readyAtMs,
			startAtMs: timing.startAtMs,
		};
	},
);

const syncRealtimeCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.syncRealtimeCraftJobFx")(
	function* ({ job }: { job: GameSaveCraftJob }) {
		if (job.delivery) return;

		const recipe = yield* readCraftJobRecipeFx({
			job,
		});
		if (
			!(yield* readCraftTargetExistsFx({
				job,
			}))
		) {
			return;
		}

		const syncState = yield* readCraftJobSyncStateFx({
			job,
			recipe,
		});

		return yield* match(syncState)
			.with("resumable", () =>
				resumePausedCraftJobFx({
					job,
					recipe,
				}),
			)
			.with("blocked", () =>
				pauseBlockedCraftJobFx({
					job,
				}),
			)
			.with("ready", () =>
				retimeReadyCraftJobFx({
					job,
					recipe,
				}),
			)
			.with("still_paused", () => Effect.void)
			.exhaustive();
	},
);

const syncRealtimeCraftJobsProgramFx = Effect.fn(
	"syncRealtimeCraftJobsFx.syncRealtimeCraftJobsProgramFx",
)(function* () {
	const jobs = yield* readSortedCraftJobsFx();
	for (const job of jobs) {
		yield* syncRealtimeCraftJobFx({
			job,
		});
	}

	const { nowMs } = yield* CraftRealtimeSyncScopeFx;
	return yield* readUpdatedGameSaveDraftResultFx({
		nowMs,
	});
});

export const syncRealtimeCraftJobsFx = Effect.fn("syncRealtimeCraftJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeCraftJobsFx.Props) {
	return yield* syncRealtimeCraftJobsProgramFx().pipe(
		Effect.provideService(CraftRealtimeSyncScopeFx, {
			config,
			nowMs,
		}),
		(effect) =>
			provideGameSaveDraftScopeFx(effect, {
				save,
			}),
	);
});
