import type { GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";

const readSequenceIndex = (job: GameSaveItemSpawnJob) =>
	job.sequenceIndex ?? Number.MAX_SAFE_INTEGER;

export const compareItemSpawnJobs = (left: GameSaveItemSpawnJob, right: GameSaveItemSpawnJob) =>
	left.readyAtMs - right.readyAtMs ||
	readSequenceIndex(left) - readSequenceIndex(right) ||
	left.id.localeCompare(right.id);
