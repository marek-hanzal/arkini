import type { GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";
import {
	isGamePausableJobPaused,
	readGamePausableJobWakeAtMs,
} from "~/v0/game/job/GamePausableJobTiming";

export const blockedCraftCompletionRetryDelayMs = 1000;

export const isCraftJobPaused = (job: GameSaveCraftJob) => isGamePausableJobPaused(job);

export const readCraftJobWakeAtMs = (job: GameSaveCraftJob) => readGamePausableJobWakeAtMs(job);
