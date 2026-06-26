import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

const compareProducerQueueOrder = (left: GameSaveProducerJob, right: GameSaveProducerJob) =>
	left.startedAtMs - right.startedAtMs ||
	left.completesAtMs - right.completesAtMs ||
	left.id.localeCompare(right.id);

export const readFirstProducerQueueJobs = (save: GameSave) => {
	const firstJobByProducerItemInstanceId = new Map<string, GameSaveProducerJob>();

	for (const job of Object.values(save.producerJobs).sort(compareProducerQueueOrder)) {
		if (!firstJobByProducerItemInstanceId.has(job.producerItemInstanceId)) {
			firstJobByProducerItemInstanceId.set(job.producerItemInstanceId, job);
		}
	}

	return Array.from(firstJobByProducerItemInstanceId.values());
};
