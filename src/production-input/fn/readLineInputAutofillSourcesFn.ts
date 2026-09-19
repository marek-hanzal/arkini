import { Option } from "effect";

import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { matchesQueryLocationFn } from "~/item-query/fn/matchesQueryLocationFn";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";

/** Shared source eligibility for automatic delivery and the player's available stock count. */
export const readLineInputAutofillSourcesFn = ({
	owner,
	runtime,
	query,
}: {
	readonly owner: BoardRuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly query: QuerySchema.Type;
}): readonly GridRuntimeItemSchema.Type[] => {
	// Pending work already owns its producer identity before a Job starts.
	const busyOwnerItemIds = new Set([
		...runtime.jobs.map((job) => job.ownerItemId),
		...runtime.jobQueue.map((request) => request.ownerItemId),
	]);
	const sources: GridRuntimeItemSchema.Type[] = [];
	for (const item of runtime.items) {
		const candidate = Option.getOrUndefined(narrowGridRuntimeItemFn(item));
		if (
			candidate === undefined ||
			candidate.id === owner.id ||
			busyOwnerItemIds.has(candidate.id) ||
			!matchesItemSelectorFn({
				item: candidate.item,
				selector: query.selector,
			}) ||
			!matchesQueryLocationFn({
				location: candidate.location,
				origin: owner.location,
				query,
				currentSpace: runtime.currentSpace,
			})
		)
			continue;
		sources.push(candidate);
	}
	return sources;
};
