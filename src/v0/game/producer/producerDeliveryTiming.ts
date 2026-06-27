import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { compareProducerQueueJobs } from "~/v0/game/producer/compareProducerQueueJobs";

export const blockedProducerDeliveryRetryDelayMs = 1000;

export const isProducerJobPaused = (job: GameSaveProducerJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

export const readProducerJobWakeAtMs = (job: GameSaveProducerJob) =>
	isProducerJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);

export const isProducerJobBlockedByPausedQueueHead = ({
	job,
	save,
}: {
	job: GameSaveProducerJob;
	save: GameSave;
}) => {
	for (const queueJob of Object.values(save.producerJobs)
		.filter((candidate) => candidate.producerItemInstanceId === job.producerItemInstanceId)
		.sort(compareProducerQueueJobs)) {
		if (queueJob.id === job.id) return false;
		if (isProducerJobPaused(queueJob)) return true;
	}

	return false;
};
