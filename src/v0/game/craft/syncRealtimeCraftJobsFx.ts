import { Effect } from "effect";
import { readCraftJobEffectiveTimingFx } from "~/v0/game/craft/readCraftJobEffectiveTimingFx";
import { isCraftJobPaused } from "~/v0/game/craft/craftCompletionTiming";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readWorldRequirementFactsFx } from "~/v0/game/world/readWorldRequirementFactsFx";

export namespace syncRealtimeCraftJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const readCraftRequirementsReadyFx = Effect.fn(
	"syncRealtimeCraftJobsFx.readCraftRequirementsReadyFx",
)(function* ({
	job,
	recipe,
	save,
}: {
	job: GameSaveCraftJob;
	recipe: GameConfig["craftRecipes"][string];
	save: GameSave;
}) {
	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: job.targetItemInstanceId,
	});
	const facts = yield* readWorldRequirementFactsFx({
		requirements: recipe.requirements,
		save,
		storedItems,
		targetItemInstanceId: job.targetItemInstanceId,
	});

	return facts.every((fact) => fact.status === "ok");
});

const readRemainingMsAtPause = ({
	job,
	nowMs,
	readyAtMs,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	readyAtMs: number;
}) => Math.max(0, readyAtMs - Math.max(nowMs, job.startAtMs));

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

		const requirementsReady = yield* readCraftRequirementsReadyFx({
			job,
			recipe,
			save: nextSave ?? save,
		});

		if (isCraftJobPaused(job)) {
			if (!requirementsReady) continue;

			const remainingMs = job.remainingMs ?? 0;
			const effectiveTiming = yield* readCraftJobEffectiveTimingFx({
				recipe,
				save: nextSave ?? save,
				startAtMs: nowMs,
				targetItemInstanceId: job.targetItemInstanceId,
			});
			const durationMs = Math.max(0, effectiveTiming.readyAtMs - effectiveTiming.startAtMs);
			const resumedStartAtMs = nowMs - Math.max(0, durationMs - remainingMs);
			const resumedReadyAtMs = resumedStartAtMs + durationMs;

			const draft = yield* ensureNextSave();
			const liveJob = draft.craftJobs[job.id];
			if (!liveJob) continue;

			draft.craftJobs[job.id] = {
				...liveJob,
				pausedAtMs: undefined,
				readyAtMs: resumedReadyAtMs,
				remainingMs: undefined,
				startAtMs: resumedStartAtMs,
			};
			continue;
		}

		if (!requirementsReady && job.startAtMs <= nowMs) {
			const remainingMs = readRemainingMsAtPause({
				job,
				nowMs,
				readyAtMs: job.readyAtMs,
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
