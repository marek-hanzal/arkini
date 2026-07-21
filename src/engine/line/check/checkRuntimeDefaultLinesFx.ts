import { Effect } from "effect";

import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import type { DefaultLineIssueSchema } from "~/engine/line/schema/check/DefaultLineIssueSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
				type: "line:default",
				ownerItemId,
				lineId,
				reason: "owner-missing",
			});
			continue;
		}
		if (!isLineOwnerItem(owner.item)) {
			issues.push({
				type: "line:default",
				ownerItemId,
				lineId,
				reason: "owner-unsupported",
			});
			continue;
		}
		if (!readLineOwnerLines(owner.item).some((line) => line.id === lineId)) {
			issues.push({
				type: "line:default",
				ownerItemId,
				lineId,
				reason: "line-missing",
			});
		}
	}
	return issues;
});
