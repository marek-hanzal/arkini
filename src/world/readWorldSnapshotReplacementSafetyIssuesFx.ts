import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldReplacementSafetyFacts } from "~/world/WorldReplacementSafetyFacts";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

const createReplacementSafetyIssueFx = Effect.fn(
	"readWorldSnapshotReplacementSafetyIssuesFx.createReplacementSafetyIssueFx",
)(function* ({
	replacementFacts,
	save,
}: {
	replacementFacts: WorldReplacementSafetyFacts;
	save: GameSave;
}) {
	if (
		!replacementFacts.blockReasons.includes("craft_job") ||
		!replacementFacts.blockReasons.includes("producer_job")
	) {
		return [];
	}

	const craftJobIds = Object.values(save.craftJobs)
		.filter((job) => job.targetItemInstanceId === replacementFacts.itemInstanceId)
		.map((job) => job.id);
	const producerJobIds = Object.values(save.producerJobs)
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
)(function* ({ facts, save }: { facts: WorldSnapshotFacts; save: GameSave }) {
	const issues: WorldCheckIssue[] = [];
	for (const replacementFacts of facts.replacementSafety) {
		issues.push(
			...(yield* createReplacementSafetyIssueFx({
				replacementFacts,
				save,
			})),
		);
	}
	return issues;
});
