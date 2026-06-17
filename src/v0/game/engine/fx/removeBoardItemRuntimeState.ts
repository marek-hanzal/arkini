import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const removeBoardItemRuntimeState = ({
	itemInstanceId,
	save,
}: {
	itemInstanceId: string;
	save: GameSave;
}) => {
	delete save.stashes[itemInstanceId];
	delete save.producerLines[itemInstanceId];
	delete save.storedRequirements[itemInstanceId];

	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		if (job.producerItemInstanceId === itemInstanceId) delete save.producerJobs[jobId];
	}

	for (const [jobId, job] of Object.entries(save.craftJobs)) {
		if (job.targetItemInstanceId === itemInstanceId) delete save.craftJobs[jobId];
	}
};
