import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { isGamePausableJobPaused, readGamePausableJobWakeAtMs } from "~/job/GamePausableJobTiming";

export const isWorldProducerJobPaused = (job: GameSaveProducerJob) => isGamePausableJobPaused(job);

export const readWorldProducerJobReleaseAtMs = (job: GameSaveProducerJob) =>
	readGamePausableJobWakeAtMs(job);
