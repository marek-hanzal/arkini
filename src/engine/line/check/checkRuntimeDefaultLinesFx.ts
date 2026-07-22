import { Effect } from "effect";

import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import type { DefaultLineIssueSchema } from "~/engine/line/schema/check/DefaultLineIssueSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { DefaultLineIssueReasonEnumSchema } from "~/engine/line/schema/check/DefaultLineIssueReasonEnumSchema";

export namespace checkRuntimeDefaultLinesFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Reports stale or foreign default-line identities retained by one runtime snapshot. */
export const checkRuntimeDefaultLinesFx = Effect.fn("checkRuntimeDefaultLinesFx")(function* ({
	runtime,
}: checkRuntimeDefaultLinesFx.Props) {
	const issues: DefaultLineIssueSchema.Type[] = [];
	for (const [ownerItemId, lineId] of Object.entries(runtime.defaultLineByOwnerItemId ?? {})) {
		const owner = runtime.items.find((item) => item.id === ownerItemId);
		if (owner === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineId,
				reason: DefaultLineIssueReasonEnumSchema.enum.OwnerMissing,
			});
			continue;
		}
		if (!isLineOwnerItem(owner.item)) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineId,
				reason: DefaultLineIssueReasonEnumSchema.enum.OwnerUnsupported,
			});
			continue;
		}
		if (!readLineOwnerLines(owner.item).some((line) => line.id === lineId)) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineId,
				reason: DefaultLineIssueReasonEnumSchema.enum.LineMissing,
			});
		}
	}
	return issues;
});
