import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { ProducerQueueSyncStep } from "~/producer/ProducerRealtimeSyncTypes";
import { compareProducerQueueJobs } from "~/producer/compareProducerQueueJobs";

export const readSortedProducerQueue = (queue: readonly GameSaveProducerJob[]) =>
	[
		...queue,
	].sort(compareProducerQueueJobs);

export const readRealtimeProducerJobIds = (queue: readonly GameSaveProducerJob[]) =>
	new Set(queue.filter((job) => !job.delivery).map((job) => job.id));

export const readHasPreviousNonDeliveryQueueJob = ({
	queue,
	queueIndex,
}: {
	queue: readonly GameSaveProducerJob[];
	queueIndex: number;
}) => queue.slice(0, queueIndex).some((previousJob) => !previousJob.delivery);

export const continueProducerQueueAt = (cursorAtMs: number): ProducerQueueSyncStep => ({
	cursorAtMs,
	stopQueue: false,
});

export const stopProducerQueueAt = (cursorAtMs: number): ProducerQueueSyncStep => ({
	cursorAtMs,
	stopQueue: true,
});
