import { Effect } from "effect";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

const createProducerDeliveryBeforeReadyIssueFx = Effect.fn(
	"readWorldSnapshotJobDeliveryIssuesFx.createProducerDeliveryBeforeReadyIssueFx",
)(function* ({ job }: WorldProducerJobFacts) {
	if (!job.delivery || job.delivery.lastBlockedAtMs >= job.readyAtMs) return [];
	return [
		{
			code: "producer_delivery_before_ready",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				lastBlockedAtMs: job.delivery.lastBlockedAtMs,
				nextAttemptAtMs: job.delivery.nextAttemptAtMs,
				readyAtMs: job.readyAtMs,
			},
			message: `Producer job "${job.id}" has blocked delivery before it is ready.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const readProducerDeliveryBeforeReadyIssuesFx = Effect.fn(
	"readWorldSnapshotJobDeliveryIssuesFx.readProducerDeliveryBeforeReadyIssuesFx",
)(function* ({ facts }: { facts: WorldSnapshotFacts }) {
	const issues: WorldCheckIssue[] = [];
	for (const producerJobFacts of facts.producerJobs) {
		issues.push(...(yield* createProducerDeliveryBeforeReadyIssueFx(producerJobFacts)));
	}
	return issues;
});

const readCraftDeliveryBeforeReadyIssuesFx = Effect.fn(
	"readWorldSnapshotJobDeliveryIssuesFx.readCraftDeliveryBeforeReadyIssuesFx",
)(function* ({ facts }: { facts: WorldSnapshotFacts }) {
	const issues: WorldCheckIssue[] = [];
	for (const { job } of facts.craftJobs) {
		if (!job.delivery || job.delivery.lastBlockedAtMs >= job.readyAtMs) continue;
		issues.push({
			code: "craft_delivery_before_ready",
			entity: {
				id: job.id,
				kind: "craftJob",
			},
			evidence: {
				lastBlockedAtMs: job.delivery.lastBlockedAtMs,
				nextAttemptAtMs: job.delivery.nextAttemptAtMs,
				readyAtMs: job.readyAtMs,
			},
			message: `Craft job "${job.id}" has blocked delivery before it is ready.`,
			severity: "error",
		});
	}
	return issues;
});

export const readWorldSnapshotJobDeliveryIssuesFx = Effect.fn(
	"readWorldSnapshotJobDeliveryIssuesFx",
)(function* ({ facts }: { facts: WorldSnapshotFacts }) {
	return [
		...(yield* readProducerDeliveryBeforeReadyIssuesFx({ facts })),
		...(yield* readCraftDeliveryBeforeReadyIssuesFx({ facts })),
	];
});
