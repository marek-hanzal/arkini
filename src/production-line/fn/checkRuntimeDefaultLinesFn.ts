import { Option } from "effect";

import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import type { DefaultLineIssueSchema } from "~/production-line/schema/DefaultLineIssueSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { DefaultLineIssueReasonEnumSchema } from "~/production-line/schema/DefaultLineIssueReasonEnumSchema";

export namespace checkRuntimeDefaultLinesFn {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Reports stale or foreign default-line identities retained by one runtime snapshot. */
export const checkRuntimeDefaultLinesFn = ({ runtime }: checkRuntimeDefaultLinesFn.Props) => {
	const issues: DefaultLineIssueSchema.Type[] = [];
	for (const [ownerItemId, lineUid] of Object.entries(runtime.defaultLineByOwnerItemId)) {
		const owner = runtime.items.find((item) => item.id === ownerItemId);
		if (owner === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineUid,
				reason: DefaultLineIssueReasonEnumSchema.enum.OwnerMissing,
			});
			continue;
		}
		const ownerItem = Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
		if (ownerItem === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineUid,
				reason: DefaultLineIssueReasonEnumSchema.enum.OwnerUnsupported,
			});
			continue;
		}
		if (lineUid === null) continue;
		const lines = ownerItem.lines;
		if (!lines.some((line) => line.uid === lineUid)) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineUid,
				reason: DefaultLineIssueReasonEnumSchema.enum.LineMissing,
			});
		}
	}
	return issues;
};
