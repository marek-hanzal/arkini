import type { GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";

export const blockedCraftCompletionRetryDelayMs = 1000;

export const isCraftJobPaused = (job: GameSaveCraftJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

export const readCraftJobWakeAtMs = (job: GameSaveCraftJob) => {
	if (isCraftJobPaused(job)) return undefined;
	return job.delivery?.nextAttemptAtMs ?? job.readyAtMs;
};
