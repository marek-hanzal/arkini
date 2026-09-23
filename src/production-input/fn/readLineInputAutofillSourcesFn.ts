import { Option } from "effect";

import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
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
}): readonly BoardRuntimeItemSchema.Type[] => {
	// Pending work already owns its producer identity before a Job starts.
	const busyOwnerItemIds = new Set([
		...runtime.jobs.map((job) => job.ownerItemId),
		...runtime.jobQueue.map((request) => request.ownerItemId),
	]);
	const sources: BoardRuntimeItemSchema.Type[] = [];
	for (const item of runtime.items) {
		const candidate = Option.getOrUndefined(narrowBoardRuntimeItemFn(item));
		if (
			candidate === undefined ||
			candidate.id === owner.id ||
			candidate.location.space !== owner.location.space ||
			busyOwnerItemIds.has(candidate.id) ||
			!matchesItemSelectorFn({
				item: candidate.item,
				selector: query.selector,
			}) ||
			!matchesQueryLocationFn({
				location: candidate.location,
				origin: owner.location,
				query,
			})
		)
			continue;
		sources.push(candidate);
	}
	return sources;
};
