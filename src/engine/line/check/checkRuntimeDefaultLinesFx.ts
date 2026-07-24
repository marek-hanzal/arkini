import { Effect, Option } from "effect";

import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
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
		const ownerItem = Option.getOrUndefined(yield* isLineOwnerItemFx(owner.item));
		if (ownerItem === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
				ownerItemId,
				lineId,
				reason: DefaultLineIssueReasonEnumSchema.enum.OwnerUnsupported,
			});
			continue;
		}
		const lines = yield* readLineOwnerLinesFx(ownerItem);
		if (!lines.some((line) => line.id === lineId)) {
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
