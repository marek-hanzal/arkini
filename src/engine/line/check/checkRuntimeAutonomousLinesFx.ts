import { Effect } from "effect";

import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { AutonomousLineIssueReasonEnumSchema } from "~/engine/line/schema/check/AutonomousLineIssueReasonEnumSchema";
import type { AutonomousLineIssueSchema } from "~/engine/line/schema/check/AutonomousLineIssueSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

/** Reports malformed, unsupported, or duplicate autonomous line selections. */
export const checkRuntimeAutonomousLinesFx = Effect.fn("checkRuntimeAutonomousLinesFx")(function* ({
	runtime,
}: {
	readonly runtime: RuntimeSchema.Type;
}) {
	const issues: AutonomousLineIssueSchema.Type[] = [];
	const seenSelections = new Set<string>();
	for (const selection of runtime.autonomousLines ?? []) {
		const issue = (
			reason: AutonomousLineIssueReasonEnumSchema.Type,
		): AutonomousLineIssueSchema.Type => ({
			line: selection,
			reason,
			type: RuntimeCheckIssueEnumSchema.enum.AutonomousLine,
		});
		const selectionKey = `${selection.ownerItemId}:${selection.lineId}`;
		if (seenSelections.has(selectionKey)) {
			issues.push(issue(AutonomousLineIssueReasonEnumSchema.enum.DuplicateSelection));
			continue;
		}
		seenSelections.add(selectionKey);
		const owner = runtime.items.find((candidate) => candidate.id === selection.ownerItemId);
		if (owner === undefined) {
			issues.push(issue(AutonomousLineIssueReasonEnumSchema.enum.OwnerMissing));
			continue;
		}
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			issues.push(issue(AutonomousLineIssueReasonEnumSchema.enum.OwnerNotOnBoard));
			continue;
		}
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: selection.lineId,
		});
		if (line === undefined) {
			issues.push(issue(AutonomousLineIssueReasonEnumSchema.enum.LineMissing));
		} else if (!line.autonomous) {
			issues.push(issue(AutonomousLineIssueReasonEnumSchema.enum.NotSupported));
		}
	}
	return issues;
});
