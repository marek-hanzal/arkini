import { Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { DuplicateItemIdIssueSchema } from "~/v1/runtime/schema/check/DuplicateItemIdIssueSchema";

export namespace checkRuntimeItemIdsFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Reports each live item identity owned by more than one runtime item.
 */
export const checkRuntimeItemIdsFx = Effect.fn("checkRuntimeItemIdsFx")(function* ({
	runtime,
}: checkRuntimeItemIdsFx.Props) {
	const issues: DuplicateItemIdIssueSchema.Type[] = [];

	for (const [index, item] of runtime.items.entries()) {
		const alreadyReported = issues.some((issue) => issue.itemId === item.id);
		if (alreadyReported) {
			continue;
		}

		const duplicated = runtime.items.slice(index + 1).some((candidate) => {
			return candidate.id === item.id;
		});
		if (duplicated) {
			issues.push({
				itemId: item.id,
				type: "item:id:duplicate",
			});
		}
	}

	return issues;
});
