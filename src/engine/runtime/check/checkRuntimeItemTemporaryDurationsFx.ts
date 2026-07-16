import { Effect } from "effect";

import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemTemporaryDurationIssueSchema } from "~/engine/runtime/schema/check/ItemTemporaryDurationIssueSchema";

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
		if (item.item.type !== "temporary") {
			if (item.remainingDurationMs !== undefined) {
				issues.push({
					type: "item:temporary-duration",
					itemId: item.id,
					remainingDurationMs: item.remainingDurationMs,
					location: item.location,
					reason: "unexpected-state",
				});
			}
			continue;
		}

		if (item.location.scope !== "board") {
			issues.push({
				type: "item:temporary-duration",
				itemId: item.id,
				durationMs: item.item.durationMs,
				remainingDurationMs: item.remainingDurationMs,
				location: item.location,
				reason: "not-board",
			});
		}
		if (item.remainingDurationMs === undefined) {
			issues.push({
				type: "item:temporary-duration",
				itemId: item.id,
				durationMs: item.item.durationMs,
				location: item.location,
				reason: "missing-state",
			});
			continue;
		}
		if (item.remainingDurationMs > item.item.durationMs) {
			issues.push({
				type: "item:temporary-duration",
				itemId: item.id,
				durationMs: item.item.durationMs,
				remainingDurationMs: item.remainingDurationMs,
				location: item.location,
				reason: "exceeds-duration",
			});
		}
	}

	return issues;
});
