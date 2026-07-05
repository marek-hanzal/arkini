import { Effect } from "effect";
import { allWorldSnapshotCheckIds } from "~/world/allWorldSnapshotCheckIds";
import { readWorldSnapshotCheckIssuesFx } from "~/world/readWorldSnapshotCheckIssuesFx";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldSnapshotValidationScope } from "~/world/WorldSnapshotValidationScope";

const readSelectedCheckIdsFx = Effect.fn("readWorldSnapshotIssuesFx.readSelectedCheckIdsFx")(
	function* ({ checks }: WorldSnapshotValidationScope) {
		return checks ?? allWorldSnapshotCheckIds;
	},
);

export const readWorldSnapshotIssuesFx = Effect.fn("readWorldSnapshotIssuesFx")(function* (
	scope: WorldSnapshotValidationScope,
) {
	const checkIds = yield* readSelectedCheckIdsFx(scope);
	const issues: WorldCheckIssue[] = [];
	for (const checkId of checkIds) {
		issues.push(
			...(yield* readWorldSnapshotCheckIssuesFx({
				checkId,
				scope,
			})),
		);
	}
	return issues;
});
