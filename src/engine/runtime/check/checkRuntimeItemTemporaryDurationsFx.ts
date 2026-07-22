import { Effect } from "effect";

import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemTemporaryDurationIssueSchema } from "~/engine/runtime/schema/check/ItemTemporaryDurationIssueSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { ItemTemporaryDurationIssueReasonEnumSchema } from "~/engine/runtime/schema/check/ItemTemporaryDurationIssueReasonEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace checkRuntimeItemTemporaryDurationsFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reports every non-canonical temporary-item lifetime state. */
export const checkRuntimeItemTemporaryDurationsFx = Effect.fn(
	"checkRuntimeItemTemporaryDurationsFx",
)(function* ({ runtime }: checkRuntimeItemTemporaryDurationsFx.Props) {
	const issues: ItemTemporaryDurationIssueSchema.Type[] = [];

	for (const item of runtime.items) {
		if (item.item.type !== ItemEnumSchema.enum.Temporary) {
			if (item.remainingDurationMs !== undefined) {
				issues.push({
					type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
					itemId: item.id,
					remainingDurationMs: item.remainingDurationMs,
					location: item.location,
					reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.UnexpectedState,
				});
			}
			continue;
		}

		if (item.location.scope !== LocationScopeEnumSchema.enum.Board) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: item.id,
				durationMs: item.item.durationMs,
				remainingDurationMs: item.remainingDurationMs,
				location: item.location,
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.NotBoard,
			});
		}
		if (item.remainingDurationMs === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: item.id,
				durationMs: item.item.durationMs,
				location: item.location,
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.MissingState,
			});
			continue;
		}
		if (item.remainingDurationMs > item.item.durationMs) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: item.id,
				durationMs: item.item.durationMs,
				remainingDurationMs: item.remainingDurationMs,
				location: item.location,
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.ExceedsDuration,
			});
		}
	}

	return issues;
});
