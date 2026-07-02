import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { compareProducerQueueJobs } from "~/v0/game/producer/compareProducerQueueJobs";
import { groupWorldProducerJobs } from "~/v0/game/world/groupWorldProducerJobs";
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

	for (const [itemInstanceId, queue] of groupWorldProducerJobs(save)) {
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
				itemInstanceId,
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
			left.itemInstanceId.localeCompare(right.itemInstanceId) ||
			left.queueIndex - right.queueIndex ||
			left.job.id.localeCompare(right.job.id),
	);
};
