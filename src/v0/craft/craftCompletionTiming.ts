import type { GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import { isGamePausableJobPaused, readGamePausableJobWakeAtMs } from "~/job/GamePausableJobTiming";

export const blockedCraftCompletionRetryDelayMs = 1000;

export const isCraftJobPaused = (job: GameSaveCraftJob) => isGamePausableJobPaused(job);

export const readCraftJobWakeAtMs = (job: GameSaveCraftJob) => readGamePausableJobWakeAtMs(job);
