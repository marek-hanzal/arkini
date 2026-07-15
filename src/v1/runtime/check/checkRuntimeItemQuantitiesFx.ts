import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import { readItemEffectiveMaxStackSizeFx } from "~/v1/item/fx/purity/readItemEffectiveMaxStackSizeFx";
import { readReservedJobOutputQuantitiesFx } from "~/v1/job/fx/read/readReservedJobOutputQuantitiesFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { ItemMaxCountIssueSchema } from "~/v1/runtime/schema/check/ItemMaxCountIssueSchema";
import type { ItemStackSizeIssueSchema } from "~/v1/runtime/schema/check/ItemStackSizeIssueSchema";

export namespace checkRuntimeItemQuantitiesFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reports effective stack-size and committed canonical maxCount violations. */
export const checkRuntimeItemQuantitiesFx = Effect.fn("checkRuntimeItemQuantitiesFx")(function* ({
	runtime,
}: checkRuntimeItemQuantitiesFx.Props) {
	const stackIssues: ItemStackSizeIssueSchema.Type[] = [];
	const maxCountIssues: ItemMaxCountIssueSchema.Type[] = [];

	for (const item of runtime.items) {
		const maxStackSize = yield* readItemEffectiveMaxStackSizeFx({
			item,
			runtime,
		});
		if (item.quantity > maxStackSize) {
			stackIssues.push({
				canonicalItemId: item.item.id,
				itemId: item.id,
				maxStackSize,
				quantity: item.quantity,
				type: "item:stack-size",
			});
		}
	}

	const reserved = yield* readReservedJobOutputQuantitiesFx({
		runtime,
	});
	const canonicalItemIds = new Set<IdSchema.Type>([
		...runtime.items.map((item) => item.item.id),
		...reserved.keys(),
	]);

	for (const itemId of canonicalItemIds) {
		const item = yield* resolveItemFx({
			itemId,
		});
		if (item.maxCount === undefined) continue;

		const items = runtime.items.filter((candidate) => candidate.item.id === itemId);
		const liveQuantity = items.reduce((total, candidate) => total + candidate.quantity, 0);
		const reservation = reserved.get(itemId);
		const reservedQuantity = reservation?.quantity ?? 0;
		const quantity = liveQuantity + reservedQuantity;
		if (quantity <= item.maxCount) continue;

		maxCountIssues.push({
			itemId,
			itemIds: items.map((candidate) => candidate.id),
			jobIds: reservation?.jobIds ?? [],
			liveQuantity,
			reservedQuantity,
			maxCount: item.maxCount,
			quantity,
			type: "item:max-count",
		});
	}

	return [
		...stackIssues,
		...maxCountIssues,
	];
});
