import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { allWorldSnapshotCheckIds } from "~/world/allWorldSnapshotCheckIds";
import { readWorldSnapshotCheckIssuesFx } from "~/world/readWorldSnapshotCheckIssuesFx";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

export const readWorldSnapshotIssuesFx = Effect.fn("readWorldSnapshotIssuesFx")(function* ({
	checks,
	facts,
	save,
}: {
	checks?: readonly WorldSnapshotCheckId[];
	facts: WorldSnapshotFacts;
	save: GameSave;
}) {
	const checkIds = checks ?? allWorldSnapshotCheckIds;
	const issues: WorldCheckIssue[] = [];
	for (const checkId of checkIds) {
		issues.push(
			...(yield* readWorldSnapshotCheckIssuesFx({
				checkId,
				facts,
				save,
			})),
		);
	}
	return issues;
});
