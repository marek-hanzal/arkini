import type { GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export const blockedProducerDeliveryRetryDelayMs = 1000;

export const isProducerJobPaused = (job: GameSaveProducerJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

export const readProducerJobWakeAtMs = (job: GameSaveProducerJob) =>
	isProducerJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);
