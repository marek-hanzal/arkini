import type { GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export const isWorldProducerJobPaused = (job: GameSaveProducerJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

export const readWorldProducerJobReleaseAtMs = (job: GameSaveProducerJob) =>
	isWorldProducerJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);
