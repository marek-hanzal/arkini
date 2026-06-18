import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const readBoardItemRuntimeStateStatus = ({
	itemInstanceId,
	save,
}: {
	itemInstanceId: string;
	save: GameSave;
}) => {
	const hasProducerJob = Object.values(save.producerJobs).some(
		(job) => job.producerItemInstanceId === itemInstanceId,
	);
	const hasCraftJob = Object.values(save.craftJobs).some(
		(job) => job.targetItemInstanceId === itemInstanceId,
	);

	return {
		busy: hasProducerJob || hasCraftJob,
		preservable:
			Boolean(save.stashes[itemInstanceId]) ||
			Boolean(save.producerLines[itemInstanceId]) ||
			Boolean(save.producerInputs[itemInstanceId]) ||
			Boolean(save.craftInputs[itemInstanceId]) ||
			Boolean(save.storedRequirements[itemInstanceId]),
	};
};
