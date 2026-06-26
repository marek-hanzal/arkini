import type { GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export const blockedProducerDeliveryRetryDelayMs = 1000;

export const readProducerJobWakeAtMs = (job: GameSaveProducerJob) =>
	job.delivery?.nextAttemptAtMs ?? job.readyAtMs;
