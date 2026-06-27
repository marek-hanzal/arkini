import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export const groupWorldProducerJobs = (save: GameSave) => {
	const groups = new Map<string, GameSaveProducerJob[]>();
	for (const job of Object.values(save.producerJobs)) {
		groups.set(job.producerItemInstanceId, [
			...(groups.get(job.producerItemInstanceId) ?? []),
			job,
		]);
	}
	return groups;
};
