import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";

export const compareProducerQueueJobs = (left: GameSaveProducerJob, right: GameSaveProducerJob) =>
	left.startAtMs - right.startAtMs ||
	left.readyAtMs - right.readyAtMs ||
	left.id.localeCompare(right.id);
