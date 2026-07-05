import { Effect } from "effect";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import { readProducerJobFactsByIdFx } from "~/world/readProducerJobFactsByIdFx";
import type { WorldSnapshotValidationScope } from "~/world/WorldSnapshotValidationScope";

const createProducerQueueDeliveryHeadIssueFx = Effect.fn(
	"readWorldSnapshotProducerQueueIssuesFx.createProducerQueueDeliveryHeadIssueFx",
)(function* ({ itemInstanceId, job, queueIndex }: WorldProducerJobFacts) {
	if (!job.delivery || queueIndex === 0) return [];
	return [
		{
			code: "producer_queue_delivery_not_head",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				itemInstanceId,
				queueIndex,
			},
			message: `Producer job "${job.id}" has blocked delivery but is not the queue head.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createProducerDeliveryPausedIssueFx = Effect.fn(
	"readWorldSnapshotProducerQueueIssuesFx.createProducerDeliveryPausedIssueFx",
)(function* ({ job }: WorldProducerJobFacts) {
	if (!job.delivery || (job.pausedAtMs === undefined && job.remainingMs === undefined)) return [];
	return [
		{
			code: "delivery_job_paused",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				pausedAtMs: job.pausedAtMs,
				remainingMs: job.remainingMs,
			},
			message: `Producer delivery job "${job.id}" must not also be paused.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createProducerQueueBarrierIssueFx = Effect.fn(
	"readWorldSnapshotProducerQueueIssuesFx.createProducerQueueBarrierIssueFx",
)(function* ({
	producerJobFacts,
	scope,
}: {
	producerJobFacts: WorldProducerJobFacts;
	scope: WorldSnapshotValidationScope;
}) {
	const { job, previousJobId } = producerJobFacts;
	if (!previousJobId) return [];
	const producerJobFactsById = yield* readProducerJobFactsByIdFx(scope);
	const previousFacts = producerJobFactsById.get(previousJobId);
	if (previousFacts?.releaseAtMs === undefined || job.startAtMs >= previousFacts.releaseAtMs) {
		return [];
	}

	return [
		{
			code: "producer_job_starts_before_queue_barrier",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				previousJobId: previousFacts.job.id,
				previousReleaseAtMs: previousFacts.releaseAtMs,
				startAtMs: job.startAtMs,
			},
			message: `Producer job "${job.id}" starts before previous queue job "${previousFacts.job.id}" releases.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

export const readWorldSnapshotProducerQueueIssuesFx = Effect.fn(
	"readWorldSnapshotProducerQueueIssuesFx",
)(function* (scope: WorldSnapshotValidationScope) {
	const issues: WorldCheckIssue[] = [];
	for (const producerJobFacts of scope.facts.producerJobs) {
		issues.push(...(yield* createProducerQueueDeliveryHeadIssueFx(producerJobFacts)));
		issues.push(...(yield* createProducerDeliveryPausedIssueFx(producerJobFacts)));
		issues.push(
			...(yield* createProducerQueueBarrierIssueFx({
				producerJobFacts,
				scope,
			})),
		);
	}
	return issues;
});
