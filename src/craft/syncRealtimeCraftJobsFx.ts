import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	readCraftRecipeDefinition,
	type GameCraftRecipeDefinition,
} from "~/config/GameItemCapabilities";
import { readCraftJobEffectiveTimingFx } from "~/craft/readCraftJobEffectiveTimingFx";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import { writeCraftJobToSaveFx } from "~/craft/writeCraftJobToSaveFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import {
	isGamePausableJobPaused,
	readGamePausableJobRemainingMsAtPause,
	readGamePausableJobResumedTiming,
} from "~/job/GamePausableJobTiming";
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

type CraftRealtimeSyncScope = Pick<syncRealtimeCraftJobsFx.Props, "config" | "nowMs">;

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
	scope,
}: {
	job: GameSaveCraftJob;
	scope: CraftRealtimeSyncScope;
}) {
	const recipe = readCraftRecipeDefinition({
		config: scope.config,
		recipeId: job.recipeId,
	});
	if (recipe) return recipe;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing craft recipe "${job.recipeId}".`),
	);
});

const readCraftStartGateReadyFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftStartGateReadyFx")(
	function* ({
		recipe,
		scope,
	}: {
		recipe: GameCraftRecipeDefinition;
		scope: CraftRealtimeSyncScope;
	}) {
		const save = yield* readGameSaveDraftCurrentFx();
		return readCraftLineEffectState({
			config: scope.config,
			nowMs: scope.nowMs,
			recipe,
			save,
		}).startGateReady;
	},
);

const readCraftJobSyncStateFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftJobSyncStateFx")(
	function* ({
		job,
		recipe,
		scope,
	}: {
		job: GameSaveCraftJob;
		recipe: GameCraftRecipeDefinition;
		scope: CraftRealtimeSyncScope;
	}) {
		const startGateReady = yield* readCraftStartGateReadyFx({
			recipe,
			scope,
		});

		if (isGamePausableJobPaused(job)) {
			return startGateReady ? "resumable" : "still_paused";
		}

		return !startGateReady && job.startAtMs <= scope.nowMs ? "blocked" : "ready";
	},
);

const readCraftTargetExistsFx = Effect.fn("syncRealtimeCraftJobsFx.readCraftTargetExistsFx")(
	function* ({ job }: { job: GameSaveCraftJob }) {
		const save = yield* readGameSaveDraftCurrentFx();
		return Boolean(save.board.items[job.targetItemInstanceId]);
	},
);

const resumePausedCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.resumePausedCraftJobFx")(
	function* ({
		job,
		recipe,
		scope,
	}: {
		job: GameSaveCraftJob;
		recipe: GameCraftRecipeDefinition;
		scope: CraftRealtimeSyncScope;
	}) {
		const save = yield* readGameSaveDraftCurrentFx();
		const remainingMs = job.remainingMs ?? 0;
		const effectiveTiming = yield* readCraftJobEffectiveTimingFx({
			recipe,
			save,
			startAtMs: scope.nowMs,
			targetItemInstanceId: job.targetItemInstanceId,
		});
		const durationMs = Math.max(0, effectiveTiming.readyAtMs - effectiveTiming.startAtMs);
		const resumedTiming = readGamePausableJobResumedTiming({
			durationMs,
			nowMs: scope.nowMs,
			remainingMs,
		});

		const draft = yield* ensureGameSaveDraftFx();
		const liveJob = draft.craftJobs[job.id];
		if (!liveJob) return;

		yield* writeCraftJobToSaveFx({
			job: {
				...liveJob,
				pausedAtMs: undefined,
				readyAtMs: resumedTiming.readyAtMs,
				remainingMs: undefined,
				startAtMs: resumedTiming.startAtMs,
			},
			save: draft,
		});
	},
);

const pauseBlockedCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.pauseBlockedCraftJobFx")(
	function* ({ job, scope }: { job: GameSaveCraftJob; scope: CraftRealtimeSyncScope }) {
		const remainingMs = readGamePausableJobRemainingMsAtPause({
			job,
			nowMs: scope.nowMs,
		});
		const draft = yield* ensureGameSaveDraftFx();
		const liveJob = draft.craftJobs[job.id];
		if (!liveJob) return;

		yield* writeCraftJobToSaveFx({
			job: {
				...liveJob,
				pausedAtMs: scope.nowMs,
				readyAtMs: scope.nowMs + remainingMs,
				remainingMs,
				startAtMs: job.startAtMs,
			},
			save: draft,
		});
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

		yield* writeCraftJobToSaveFx({
			job: {
				...liveJob,
				readyAtMs: timing.readyAtMs,
				startAtMs: timing.startAtMs,
			},
			save: draft,
		});
	},
);

const syncRealtimeCraftJobFx = Effect.fn("syncRealtimeCraftJobsFx.syncRealtimeCraftJobFx")(
	function* ({ job, scope }: { job: GameSaveCraftJob; scope: CraftRealtimeSyncScope }) {
		if (job.delivery) return;

		const recipe = yield* readCraftJobRecipeFx({
			job,
			scope,
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
			scope,
		});

		return yield* match(syncState)
			.with("resumable", () =>
				resumePausedCraftJobFx({
					job,
					recipe,
					scope,
				}),
			)
			.with("blocked", () =>
				pauseBlockedCraftJobFx({
					job,
					scope,
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
)(function* (scope: CraftRealtimeSyncScope) {
	const jobs = yield* readSortedCraftJobsFx();
	for (const job of jobs) {
		yield* syncRealtimeCraftJobFx({
			job,
			scope,
		});
	}

	return yield* readUpdatedGameSaveDraftResultFx({
		nowMs: scope.nowMs,
	});
});

export const syncRealtimeCraftJobsFx = Effect.fn("syncRealtimeCraftJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeCraftJobsFx.Props) {
	return yield* syncRealtimeCraftJobsProgramFx({
		config,
		nowMs,
	}).pipe((effect) =>
		provideGameSaveDraftScopeFx(effect, {
			save,
		}),
	);
});
