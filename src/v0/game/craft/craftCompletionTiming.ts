import type { GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";

export const blockedCraftCompletionRetryDelayMs = 1000;

export const readCraftJobWakeAtMs = (job: GameSaveCraftJob) =>
	job.delivery?.nextAttemptAtMs ?? job.readyAtMs;
