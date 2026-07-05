import type { GameSaveProducerJob } from "~/engine/model/GameSaveShapeSchema";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import type { ProducerJobEntry } from "~/engine/model/GameSaveProducerValidationTypes";

const isSaveProducerJobPaused = (job: GameSaveProducerJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

const readProducerQueueBarrierAtMs = (job: GameSaveProducerJob) =>
	isSaveProducerJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);

const readSortedProducerJobs = (producerJobs: readonly ProducerJobEntry[]) =>
	[
		...producerJobs,
	].sort(
		(left, right) =>
			left.job.startAtMs - right.job.startAtMs ||
			left.job.readyAtMs - right.job.readyAtMs ||
			left.jobId.localeCompare(right.jobId),
	);

export const validateProducerQueueOrdering = ({
	ctx,
	jobsByItemInstanceId,
}: Pick<GameSaveValidationContext, "ctx"> & {
	jobsByItemInstanceId: ReadonlyMap<string, readonly ProducerJobEntry[]>;
}) => {
	for (const [itemInstanceId, producerJobs] of jobsByItemInstanceId) {
		const sortedProducerJobs = readSortedProducerJobs(producerJobs);
		for (let index = 1; index < sortedProducerJobs.length; index += 1) {
			const previous = sortedProducerJobs[index - 1];
			const current = sortedProducerJobs[index];
			if (!previous || !current) continue;

			if (current.job.delivery) {
				addSaveIssue(
					ctx,
					[
						"producerJobs",
						current.jobId,
						"delivery",
					],
					`Producer job "${current.jobId}" for "${itemInstanceId}" has blocked delivery but is not first in the producer queue.`,
				);
			}

			const previousQueueBarrierAtMs = readProducerQueueBarrierAtMs(previous.job);
			if (previousQueueBarrierAtMs === undefined) continue;

			if (current.job.startAtMs < previousQueueBarrierAtMs) {
				addSaveIssue(
					ctx,
					[
						"producerJobs",
						current.jobId,
						"startAtMs",
					],
					`Producer job "${current.jobId}" for "${itemInstanceId}" starts before previous job "${previous.jobId}" releases the queue.`,
				);
			}
		}

		for (const current of sortedProducerJobs) {
			if (
				!current.job.delivery ||
				current.job.delivery.lastBlockedAtMs >= current.job.readyAtMs
			) {
				continue;
			}

			addSaveIssue(
				ctx,
				[
					"producerJobs",
					current.jobId,
					"delivery",
					"lastBlockedAtMs",
				],
				`Producer job "${current.jobId}" cannot be blocked before it is ready.`,
			);
		}
	}
};
