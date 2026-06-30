import type { GameSave, GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";

export const isItemSpawnJobWaitingForDependencies = ({
	job,
	save,
}: {
	job: GameSaveItemSpawnJob;
	save: GameSave;
}) => Boolean(job.afterJobIds?.some((jobId) => save.itemSpawnJobs[jobId]));
