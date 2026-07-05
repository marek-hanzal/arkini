import { Effect } from "effect";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldReplacementSafetyFacts } from "~/world/WorldReplacementSafetyFacts";
import type { WorldSnapshotValidationScope } from "~/world/WorldSnapshotValidationScope";

const createReplacementSafetyIssueFx = Effect.fn(
	"readWorldSnapshotReplacementSafetyIssuesFx.createReplacementSafetyIssueFx",
)(function* ({
	replacementFacts,
	scope,
}: {
	replacementFacts: WorldReplacementSafetyFacts;
	scope: WorldSnapshotValidationScope;
}) {
	if (
		!replacementFacts.blockReasons.includes("craft_job") ||
		!replacementFacts.blockReasons.includes("producer_job")
	) {
		return [];
	}

	const craftJobIds = Object.values(scope.save.craftJobs)
		.filter((job) => job.targetItemInstanceId === replacementFacts.itemInstanceId)
		.map((job) => job.id);
	const producerJobIds = Object.values(scope.save.producerJobs)
		.filter((job) => job.itemInstanceId === replacementFacts.itemInstanceId)
		.map((job) => job.id);
	return [
		{
			code: "craft_and_producer_share_target",
			entity: {
				id: replacementFacts.itemInstanceId,
				kind: "boardItem",
			},
			evidence: {
				blockReasons: replacementFacts.blockReasons,
				craftJobIds,
				producerJobIds,
			},
			message: `Board item "${replacementFacts.itemInstanceId}" has both craft and producer runtime jobs.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

export const readWorldSnapshotReplacementSafetyIssuesFx = Effect.fn(
	"readWorldSnapshotReplacementSafetyIssuesFx",
)(function* (scope: WorldSnapshotValidationScope) {
	const issues: WorldCheckIssue[] = [];
	for (const replacementFacts of scope.facts.replacementSafety) {
		issues.push(
			...(yield* createReplacementSafetyIssueFx({
				replacementFacts,
				scope,
			})),
		);
	}
	return issues;
});
