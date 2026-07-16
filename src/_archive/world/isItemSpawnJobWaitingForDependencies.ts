import type { GameSave, GameSaveItemSpawnJob } from "~/engine/model/GameSaveSchema";

export const isItemSpawnJobWaitingForDependencies = ({
	job,
	save,
}: {
	job: GameSaveItemSpawnJob;
	save: GameSave;
}) => Boolean(job.afterJobIds?.some((jobId) => save.itemSpawnJobs[jobId]));
