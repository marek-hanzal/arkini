import { Effect } from "effect";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import type { dropFx } from "~/production-output/fx/dropFx";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

interface AssertPlacementMaxCountProps {
	readonly drop: dropFx.Result;
	readonly item: ItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

/**
 * Rejects placement that would exceed one canonical item's global maxCount.
 */
export const assertPlacementMaxCountFx = Effect.fn("assertPlacementMaxCountFx")(function* ({
	drop,
	item,
	runtime,
}: AssertPlacementMaxCountProps) {
	if (item.maxCount === undefined) {
		return;
	}

	const existingQuantity = runtime.items.reduce((quantity, candidate) => {
		return candidate.item.id === item.id ? quantity + candidate.quantity : quantity;
	}, 0);
	const reservedQuantity =
		readReservedJobOutputQuantitiesFn({
			runtime,
		}).get(item.id)?.quantity ?? 0;
	const excessQuantity = existingQuantity + reservedQuantity + drop.quantity - item.maxCount;
	if (excessQuantity <= 0) {
		return;
	}

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason: PlacementUnavailableError.Reason.ItemMaxCount,
			remainingQuantity: excessQuantity,
		}),
	);
});
