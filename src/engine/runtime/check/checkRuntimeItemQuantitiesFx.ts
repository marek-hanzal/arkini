import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { isItemPureWithIndexFn } from "~/engine/item/fn/isItemPureWithIndexFn";
import { readItemPurityIndexFn } from "~/engine/item/fn/readItemPurityIndexFn";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemMaxCountIssueSchema } from "~/engine/runtime/schema/check/ItemMaxCountIssueSchema";
import type { ItemStackSizeIssueSchema } from "~/engine/runtime/schema/check/ItemStackSizeIssueSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

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
	const purityIndex = readItemPurityIndexFn(runtime);
	const liveByCanonicalItemId = new Map<
		IdSchema.Type,
		{
			readonly itemIds: IdSchema.Type[];
			quantity: number;
		}
	>();

	for (const item of runtime.items) {
		const maxStackSize = isItemPureWithIndexFn({
			index: purityIndex,
			item,
			runtime,
		})
			? item.item.maxStackSize
			: 1;
		if (item.quantity > maxStackSize) {
			stackIssues.push({
				canonicalItemId: item.item.id,
				itemId: item.id,
				maxStackSize,
				quantity: item.quantity,
				type: RuntimeCheckIssueEnumSchema.enum.ItemStackSize,
			});
		}
		const live = liveByCanonicalItemId.get(item.item.id);
		if (live === undefined) {
			liveByCanonicalItemId.set(item.item.id, {
				itemIds: [
					item.id,
				],
				quantity: item.quantity,
			});
		} else {
			live.itemIds.push(item.id);
			live.quantity += item.quantity;
		}
	}

	const reserved = readReservedJobOutputQuantitiesFn({
		runtime,
	});
	const canonicalItemIds = new Set<IdSchema.Type>([
		...liveByCanonicalItemId.keys(),
		...reserved.keys(),
	]);
	const config = yield* GameConfigFx;

	for (const itemId of canonicalItemIds) {
		const item =
			config.items[itemId] ??
			(yield* resolveItemFx({
				itemId,
			}));
		if (item.maxCount === undefined) continue;

		const live = liveByCanonicalItemId.get(itemId);
		const liveQuantity = live?.quantity ?? 0;
		const reservation = reserved.get(itemId);
		const reservedQuantity = reservation?.quantity ?? 0;
		const quantity = liveQuantity + reservedQuantity;
		if (quantity <= item.maxCount) continue;

		maxCountIssues.push({
			itemId,
			itemIds: live?.itemIds ?? [],
			jobIds: reservation?.jobIds ?? [],
			liveQuantity,
			reservedQuantity,
			maxCount: item.maxCount,
			quantity,
			type: RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
		});
	}

	return [
		...stackIssues,
		...maxCountIssues,
	];
});
