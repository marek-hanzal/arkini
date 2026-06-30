import { Effect } from "effect";
import { readCraftJobEffectiveTimingFx } from "~/v0/game/craft/readCraftJobEffectiveTimingFx";
import {
	isGamePausableJobPaused,
	readGamePausableJobRemainingMsAtPause,
	readGamePausableJobResumedTiming,
} from "~/v0/game/job/GamePausableJobTiming";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readCraftLineEffectState } from "~/v0/game/craft/readCraftLineEffectState";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";

export namespace syncRealtimeCraftJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const readCraftGrantsReady = ({
	config,
	job,
	nowMs,
	recipe,
	save,
	targetItem,
}: {
	config: GameConfig;
	job: GameSaveCraftJob;
	nowMs: number;
	recipe: GameConfig["craftRecipes"][string];
	save: GameSave;
	targetItem: GameSave["board"]["items"][string];
}) =>
	readCraftLineEffectState({
		config,
		nowMs,
		recipe,
		recipeId: job.recipeId,
		save,
		targetItem,
	}).grantsReady;

export const syncRealtimeCraftJobsFx = Effect.fn("syncRealtimeCraftJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeCraftJobsFx.Props) {
	let nextSave: GameSave | undefined;
	const ensureNextSave = Effect.fn("syncRealtimeCraftJobsFx.ensureNextSave")(function* () {
		if (!nextSave) {
			nextSave = yield* cloneGameSaveFx({
				save,
			});
		}
		return nextSave;
	});

	const jobs = Object.values(save.craftJobs).sort(
		(left, right) => left.startAtMs - right.startAtMs || left.id.localeCompare(right.id),
	);

	for (const job of jobs) {
		if (job.delivery) continue;

		const recipe = config.craftRecipes[job.recipeId];
		if (!recipe) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing craft recipe "${job.recipeId}".`),
			);
		}

		const targetItem = (nextSave ?? save).board.items[job.targetItemInstanceId];
		if (!targetItem) continue;

		const grantsReady = readCraftGrantsReady({
			config,
			job,
			nowMs,
			recipe,
			save: nextSave ?? save,
			targetItem,
		});

		if (isGamePausableJobPaused(job)) {
			if (!grantsReady) continue;

			const remainingMs = job.remainingMs ?? 0;
			const effectiveTiming = yield* readCraftJobEffectiveTimingFx({
				recipe,
				save: nextSave ?? save,
				startAtMs: nowMs,
				targetItemInstanceId: job.targetItemInstanceId,
			});
			const durationMs = Math.max(0, effectiveTiming.readyAtMs - effectiveTiming.startAtMs);
			const resumedTiming = readGamePausableJobResumedTiming({
				durationMs,
				nowMs,
				remainingMs,
			});

			const draft = yield* ensureNextSave();
			const liveJob = draft.craftJobs[job.id];
			if (!liveJob) continue;

			draft.craftJobs[job.id] = {
				...liveJob,
				pausedAtMs: undefined,
				readyAtMs: resumedTiming.readyAtMs,
				remainingMs: undefined,
				startAtMs: resumedTiming.startAtMs,
			};
			continue;
		}

		if (!grantsReady && job.startAtMs <= nowMs) {
			const remainingMs = readGamePausableJobRemainingMsAtPause({
				job,
				nowMs,
			});
			const draft = yield* ensureNextSave();
			const liveJob = draft.craftJobs[job.id];
			if (!liveJob) continue;

			draft.craftJobs[job.id] = {
				...liveJob,
				pausedAtMs: nowMs,
				readyAtMs: nowMs + remainingMs,
				remainingMs,
				startAtMs: job.startAtMs,
			};
			continue;
		}

		const timing = yield* readCraftJobEffectiveTimingFx({
			recipe,
			save: nextSave ?? save,
			startAtMs: job.startAtMs,
			targetItemInstanceId: job.targetItemInstanceId,
		});

		if (job.startAtMs === timing.startAtMs && job.readyAtMs === timing.readyAtMs) continue;

		const draft = yield* ensureNextSave();
		const liveJob = draft.craftJobs[job.id];
		if (!liveJob) continue;

		draft.craftJobs[job.id] = {
			...liveJob,
			readyAtMs: timing.readyAtMs,
			startAtMs: timing.startAtMs,
		};
	}

	if (!nextSave) return save;
	nextSave.updatedAtMs = nowMs;
	return nextSave;
});
