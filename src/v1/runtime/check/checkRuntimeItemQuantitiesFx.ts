import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { ItemMaxCountIssueSchema } from "~/v1/runtime/schema/check/ItemMaxCountIssueSchema";
import type { ItemStackSizeIssueSchema } from "~/v1/runtime/schema/check/ItemStackSizeIssueSchema";

export namespace checkRuntimeItemQuantitiesFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Reports stack-size and global canonical item-count violations.
 */
export const checkRuntimeItemQuantitiesFx = Effect.fn("checkRuntimeItemQuantitiesFx")(function* ({
	runtime,
}: checkRuntimeItemQuantitiesFx.Props) {
	const stackIssues: ItemStackSizeIssueSchema.Type[] = [];
	const maxCountIssues: ItemMaxCountIssueSchema.Type[] = [];
	const checkedCanonicalItemIds: IdSchema.Type[] = [];

	for (const item of runtime.items) {
		if (item.quantity > item.item.maxStackSize) {
			stackIssues.push({
				canonicalItemId: item.item.id,
				itemId: item.id,
				maxStackSize: item.item.maxStackSize,
				quantity: item.quantity,
				type: "item:stack-size",
			});
		}

		if (item.item.maxCount === undefined || checkedCanonicalItemIds.includes(item.item.id)) {
			continue;
		}
		checkedCanonicalItemIds.push(item.item.id);

		const items = runtime.items.filter((candidate) => candidate.item.id === item.item.id);
		const quantity = items.reduce((total, candidate) => total + candidate.quantity, 0);
		if (quantity > item.item.maxCount) {
			maxCountIssues.push({
				itemId: item.item.id,
				itemIds: items.map((candidate) => candidate.id),
				maxCount: item.item.maxCount,
				quantity,
				type: "item:max-count",
			});
		}
	}

	return [
		...stackIssues,
		...maxCountIssues,
	];
});
