import type { GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import {
	isGamePausableJobPaused,
	readGamePausableJobWakeAtMs,
} from "~/v0/game/job/GamePausableJobTiming";

export const isWorldProducerJobPaused = (job: GameSaveProducerJob) => isGamePausableJobPaused(job);

export const readWorldProducerJobReleaseAtMs = (job: GameSaveProducerJob) =>
	readGamePausableJobWakeAtMs(job);
