import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";

export const groupWorldProducerJobs = (save: GameSave) => {
	const groups = new Map<string, GameSaveProducerJob[]>();
	for (const job of Object.values(save.producerJobs)) {
		groups.set(job.itemInstanceId, [
			...(groups.get(job.itemInstanceId) ?? []),
			job,
		]);
	}
	return groups;
};
