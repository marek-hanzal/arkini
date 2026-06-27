import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { compareProducerQueueJobs } from "~/v0/game/producer/compareProducerQueueJobs";
import {
	isWorldProducerJobPaused,
	readWorldProducerJobReleaseAtMs,
} from "~/v0/game/world/readWorldProducerJobReleaseAtMs";
import type { WorldProducerJobFacts } from "~/v0/game/world/WorldProducerJobFacts";

export namespace readWorldProducerJobFacts {
	export interface Props {
		nowMs?: number;
		save: GameSave;
	}
}

const groupProducerJobs = (save: GameSave) => {
	const groups = new Map<string, GameSaveProducerJob[]>();
	for (const job of Object.values(save.producerJobs)) {
		groups.set(job.producerItemInstanceId, [
			...(groups.get(job.producerItemInstanceId) ?? []),
			job,
		]);
	}
	return groups;
};

const readJobStatus = ({
	blockedByPausedQueueHead,
	job,
	nowMs,
}: {
	blockedByPausedQueueHead: boolean;
	job: GameSaveProducerJob;
	nowMs?: number;
}): WorldProducerJobFacts["status"] => {
	if (blockedByPausedQueueHead) return "blocked_by_paused_queue_head";
	if (job.delivery) return "delivery_blocked";
	if (isWorldProducerJobPaused(job)) return "paused";
	if (nowMs !== undefined && job.readyAtMs <= nowMs) return "ready";
	if (nowMs !== undefined && job.startAtMs <= nowMs) return "running";
	return "queued";
};

export const readWorldProducerJobFacts = ({
	nowMs,
	save,
}: readWorldProducerJobFacts.Props): WorldProducerJobFacts[] => {
	const facts: WorldProducerJobFacts[] = [];

	for (const [producerItemInstanceId, queue] of groupProducerJobs(save)) {
		let hasPausedBarrier = false;
		const sortedQueue = [
			...queue,
		].sort(compareProducerQueueJobs);

		for (const [queueIndex, job] of sortedQueue.entries()) {
			const blockedByPausedQueueHead = hasPausedBarrier;
			const releaseAtMs = blockedByPausedQueueHead
				? undefined
				: readWorldProducerJobReleaseAtMs(job);
			const previousJob = sortedQueue[queueIndex - 1];

			facts.push({
				job,
				previousJobId: previousJob?.id,
				producerItemInstanceId,
				queueIndex,
				releaseAtMs,
				status: readJobStatus({
					blockedByPausedQueueHead,
					job,
					nowMs,
				}),
			});

			if (isWorldProducerJobPaused(job)) {
				hasPausedBarrier = true;
			}
		}
	}

	return facts.sort(
		(left, right) =>
			left.producerItemInstanceId.localeCompare(right.producerItemInstanceId) ||
			left.queueIndex - right.queueIndex ||
			left.job.id.localeCompare(right.job.id),
	);
};
